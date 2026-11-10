/**
 * Payment Engine & Webhook Receiver Domain Service
 * Complies with PRD Section 7.3, Section 17.3, 17.5, and API_CONTRACT_V1.md Section 3.4 & 3.5.
 *
 * Responsibilities:
 * 1. Mock payment gateway adapter handling test cards (Zero storing of raw PAN / CVV).
 * 2. Order state transitions (PENDING_PAYMENT -> PAID) and status history recording.
 * 3. Commit inventory reservations upon successful payment via `commitInventoryReservation`.
 * 4. Durable webhook receiver with cryptographic HMAC signature verification and replay deduplication.
 * 5. Strict idempotency enforcement.
 *
 * Boundaries:
 * - NEVER perform financial arithmetic using binary floating point; always integer minor units (cents).
 * - NEVER store raw card numbers, CVVs, or unmasked sensitive payment data.
 * - Zero `any` types.
 */

import crypto from "crypto";
import { nanoid } from "nanoid";
import { prisma, type Prisma } from "../../lib/db";
import { commitInventoryReservation } from "../../lib/db";
import { generatePaymentReference } from "../../lib/identifiers";
import { timingSafeEqualString } from "../../lib/crypto";

// =============================================================================
// Constants & Configuration
// =============================================================================

export const DEFAULT_MOCK_SECRET = "mock_webhook_secret_development";

export class PaymentError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 400,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "PaymentError";
  }
}

// =============================================================================
// Interfaces & Types
// =============================================================================

export interface CardInput {
  type?: "card" | "mock";
  cardNumber: string;
  expMonth: number;
  expYear: number;
  cvc: string;
}

export interface ProcessPaymentParams {
  orderReference: string;
  paymentMethod: CardInput;
  idempotencyKey?: string;
}

export interface MaskedPaymentMethod {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

export interface PaymentProcessResult {
  success: boolean;
  orderReference: string;
  status: "PAID" | "PENDING_PAYMENT" | "FAILED";
  attemptId?: string;
  transactionId: string;
  providerTransactionId: string;
  amountMinor: number;
  currency: string;
  paymentMethod: MaskedPaymentMethod;
  failureReason?: string;
  failureCode?: string;
}

export interface PaymentWebhookParams {
  eventId: string;
  eventType: string;
  provider?: string;
  orderReference?: string;
  transactionId?: string;
  amountMinor?: number;
  status?: "SUCCEEDED" | "FAILED";
  payload?: Record<string, unknown>;
  rawBody?: string;
  signature?: string;
}

export interface WebhookResult {
  received: boolean;
  duplicate: boolean;
  processed?: boolean;
  eventId: string;
}

// =============================================================================
// Payment Service Implementation
// =============================================================================

export class PaymentService {
  /**
   * Identifies card brand based on card number prefix.
   */
  private detectBrand(cleanCardNumber: string): string {
    if (cleanCardNumber.startsWith("4")) return "Visa";
    if (/^(5[1-5]|2[2-7])/.test(cleanCardNumber)) return "MasterCard";
    if (/^3[47]/.test(cleanCardNumber)) return "American Express";
    if (/^6(011|5)/.test(cleanCardNumber)) return "Discover";
    return "MockCard";
  }

  /**
   * Generates a cryptographic HMAC-SHA256 signature for mock webhook payloads.
   */
  generateWebhookSignature(
    payload: string,
    secret: string = process.env.MOCK_WEBHOOK_SECRET || process.env.PAYMENT_WEBHOOK_SECRET || DEFAULT_MOCK_SECRET
  ): string {
    return crypto.createHmac("sha256", secret).update(payload, "utf8").digest("hex");
  }

  /**
   * Verifies an incoming webhook cryptographic signature.
   * Handles both raw hex signatures and timestamped Stripe format `t=timestamp,v1=signature`.
   */
  verifyWebhookSignature(
    rawBody: string,
    signatureHeader: string,
    secret: string = process.env.MOCK_WEBHOOK_SECRET || process.env.PAYMENT_WEBHOOK_SECRET || DEFAULT_MOCK_SECRET
  ): boolean {
    if (!signatureHeader || !rawBody) return false;

    // 1. Stripe-style signature header format: "t=12345678,v1=abcdef..."
    if (signatureHeader.includes("v1=")) {
      const parts = signatureHeader.split(",");
      let timestamp = "";
      let hash = "";

      for (const part of parts) {
        const [key, val] = part.trim().split("=");
        if (key === "t") timestamp = val;
        if (key === "v1") hash = val;
      }

      if (!hash) return false;

      // Anti-replay clock skew check (5 minutes = 300 seconds)
      if (timestamp) {
        const eventSec = parseInt(timestamp, 10);
        const currentSec = Math.floor(Date.now() / 1000);
        if (isNaN(eventSec) || Math.abs(currentSec - eventSec) > 300) {
          return false;
        }
      }

      const signedPayload = `${timestamp}.${rawBody}`;
      const expected = crypto.createHmac("sha256", secret).update(signedPayload, "utf8").digest("hex");
      return timingSafeEqualString(expected, hash);
    }

    // 2. Direct hex signature format
    const expectedHash = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
    return timingSafeEqualString(expectedHash, signatureHeader.trim());
  }

  /**
   * Processes a payment attempt against the Mock Payment Gateway.
   * Never stores raw card number or CVV in database.
   *
   * Mock Gateway Test Card Rules:
   * - Ends with "0002" -> Declined by issuer
   * - Ends with "0004" -> Expired card
   * - Ends with "0008" -> Insufficient funds
   * - Any other valid card (e.g. 4242...) -> Succeeded
   */
  async processPayment(params: ProcessPaymentParams): Promise<PaymentProcessResult> {
    const cleanCard = params.paymentMethod.cardNumber.replace(/[\s-]/g, "");
    const last4 = cleanCard.slice(-4);
    const brand = this.detectBrand(cleanCard);

    // 1. Resolve Target Order
    const order = await prisma.order.findFirst({
      where: {
        OR: [{ publicReference: params.orderReference }, { id: params.orderReference }],
      },
      include: {
        orderItems: true,
        paymentAttempts: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!order) {
      throw new PaymentError(
        "ORDER_NOT_FOUND",
        `Order '${params.orderReference}' does not exist.`,
        404
      );
    }

    // 2. Idempotency Check: Order is already paid
    if (order.status === "PAID") {
      const existingSuccess = order.paymentAttempts.find((p) => p.status === "SUCCEEDED");
      const txId = existingSuccess?.providerTransactionId || `txn_${order.id.slice(0, 16)}`;
      return {
        success: true,
        orderReference: order.publicReference,
        status: "PAID",
        attemptId: existingSuccess?.id,
        transactionId: txId,
        providerTransactionId: txId,
        amountMinor: order.totalMinor,
        currency: order.currency,
        paymentMethod: {
          brand,
          last4,
          expMonth: params.paymentMethod.expMonth,
          expYear: params.paymentMethod.expYear,
        },
      };
    }

    if (order.status !== "PENDING_PAYMENT") {
      throw new PaymentError(
        "INVALID_ORDER_STATE",
        `Order is in status '${order.status}' and cannot accept payment.`,
        400
      );
    }

    // 3. Evaluate Card Validity & Mock Payment Outcome
    const now = new Date();
    const currentYear = now.getUTCFullYear();
    const currentMonth = now.getUTCMonth() + 1;

    let isSuccess = true;
    let failureReason: string | undefined;
    let failureCode: string | undefined;

    if (
      params.paymentMethod.expYear < currentYear ||
      (params.paymentMethod.expYear === currentYear && params.paymentMethod.expMonth < currentMonth)
    ) {
      isSuccess = false;
      failureReason = "Card has expired.";
      failureCode = "EXPIRED_CARD";
    } else if (cleanCard.endsWith("0002")) {
      isSuccess = false;
      failureReason = "Card was declined by issuing bank.";
      failureCode = "CARD_DECLINED";
    } else if (cleanCard.endsWith("0004")) {
      isSuccess = false;
      failureReason = "Card has expired.";
      failureCode = "EXPIRED_CARD";
    } else if (cleanCard.endsWith("0008")) {
      isSuccess = false;
      failureReason = "Insufficient funds in customer account.";
      failureCode = "INSUFFICIENT_FUNDS";
    }

    const transactionId = `txn_${nanoid(20)}`;
    let attemptId: string | undefined;

    // 4. Atomic Execution in Database Transaction
    await prisma.$transaction(async (tx) => {
      if (isSuccess) {
        // Record successful PaymentAttempt
        const attempt = await tx.paymentAttempt.create({
          data: {
            orderId: order.id,
            provider: "mock",
            providerTransactionId: transactionId,
            amountMinor: order.totalMinor,
            currency: order.currency,
            status: "SUCCEEDED",
            errorDetails: null,
          },
        });
        attemptId = attempt.id;

        // Transition Order state to PAID
        await tx.order.update({
          where: { id: order.id },
          data: { status: "PAID" },
        });

        // Record OrderStatusHistory
        await tx.orderStatusHistory.create({
          data: {
            orderId: order.id,
            fromStatus: order.status,
            toStatus: "PAID",
            source: "PAYMENT_GATEWAY",
            reason: `Payment authorization succeeded (Tx: ${transactionId})`,
          },
        });

        // Step: Commit Inventory Reservations (Deduct on_hand and reserved)
        for (const item of order.orderItems) {
          await commitInventoryReservation(tx, item.variantId, item.quantity);
        }

        // Step: Mark inventory reservations as COMMITTED
        const variantIds = order.orderItems.map((item) => item.variantId);
        await tx.inventoryReservation.updateMany({
          where: {
            variantId: { in: variantIds },
            status: "ACTIVE",
          },
          data: {
            status: "COMMITTED",
            orderId: order.id,
          },
        });
      } else {
        // Record failed PaymentAttempt
        const attempt = await tx.paymentAttempt.create({
          data: {
            orderId: order.id,
            provider: "mock",
            providerTransactionId: transactionId,
            amountMinor: order.totalMinor,
            currency: order.currency,
            status: "FAILED",
            errorDetails: failureReason || "Payment declined",
          },
        });
        attemptId = attempt.id;

        // Record failure in status history (Order remains PENDING_PAYMENT)
        await tx.orderStatusHistory.create({
          data: {
            orderId: order.id,
            fromStatus: order.status,
            toStatus: order.status,
            source: "SYSTEM",
            reason: `Payment attempt failed: ${failureReason}`,
          },
        });
      }
    });

    return {
      success: isSuccess,
      orderReference: order.publicReference,
      status: isSuccess ? "PAID" : "PENDING_PAYMENT",
      attemptId,
      transactionId,
      providerTransactionId: transactionId,
      amountMinor: order.totalMinor,
      currency: order.currency,
      paymentMethod: {
        brand,
        last4,
        expMonth: params.paymentMethod.expMonth,
        expYear: params.paymentMethod.expYear,
      },
      failureReason,
      failureCode,
    };
  }

  /**
   * Receives and processes a durable signed webhook event from the payment gateway.
   * Enforces replay protection via `PaymentEvent` table deduplication (`@@unique([provider, eventId])`).
   */
  async handleWebhook(params: PaymentWebhookParams): Promise<WebhookResult> {
    const provider = params.provider || "mock";
    const rawPayload = params.rawBody || JSON.stringify(params.payload || {});

    // 1. Verify Cryptographic Signature if signature provided or required
    if (params.signature) {
      const isValid = this.verifyWebhookSignature(rawPayload, params.signature);
      if (!isValid) {
        throw new PaymentError(
          "INVALID_SIGNATURE",
          "Cryptographic webhook signature verification failed.",
          401
        );
      }
    }

    const payloadHash = crypto.createHash("sha256").update(rawPayload).digest("hex");

    // 2. Replay Protection: Atomically persist PaymentEvent
    let eventRecord;
    try {
      eventRecord = await prisma.paymentEvent.create({
        data: {
          provider,
          eventId: params.eventId,
          payloadHash,
          payloadJson: rawPayload,
          status: "RECEIVED",
        },
      });
    } catch (err: unknown) {
      // Prisma P2002: Unique constraint violation on [provider, eventId]
      if (
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        (err as { code: string }).code === "P2002"
      ) {
        return {
          received: true,
          duplicate: true,
          eventId: params.eventId,
        };
      }
      throw err;
    }

    // 3. Process State Machine Progression for Success Events
    const isSuccessEvent =
      params.eventType === "payment_intent.succeeded" ||
      params.eventType === "charge.succeeded" ||
      params.status === "SUCCEEDED";

    if (isSuccessEvent) {
      const orderRef =
        params.orderReference ||
        (params.payload?.orderReference as string | undefined) ||
        ((params.payload?.metadata as Record<string, unknown> | undefined)?.orderReference as string | undefined);

      if (orderRef) {
        const order = await prisma.order.findFirst({
          where: {
            OR: [{ publicReference: orderRef }, { id: orderRef }],
          },
          include: { orderItems: true },
        });

        if (order && order.status === "PENDING_PAYMENT") {
          const transactionId = params.transactionId || generatePaymentReference();

          await prisma.$transaction(async (tx) => {
            // Update Order to PAID
            await tx.order.update({
              where: { id: order.id },
              data: { status: "PAID" },
            });

            // Create PaymentAttempt record
            await tx.paymentAttempt.create({
              data: {
                orderId: order.id,
                provider,
                providerTransactionId: transactionId,
                amountMinor: params.amountMinor || order.totalMinor,
                currency: order.currency,
                status: "SUCCEEDED",
              },
            });

            // Record status history
            await tx.orderStatusHistory.create({
              data: {
                orderId: order.id,
                fromStatus: "PENDING_PAYMENT",
                toStatus: "PAID",
                source: "WEBHOOK",
                reason: `Payment confirmed via webhook event '${params.eventId}'`,
              },
            });

            // Commit inventory reservations
            for (const item of order.orderItems) {
              await commitInventoryReservation(tx, item.variantId, item.quantity);
            }

            // Mark reservations COMMITTED
            const variantIds = order.orderItems.map((item) => item.variantId);
            await tx.inventoryReservation.updateMany({
              where: {
                variantId: { in: variantIds },
                status: "ACTIVE",
              },
              data: {
                status: "COMMITTED",
                orderId: order.id,
              },
            });
          });
        }
      }

      // Mark Event as PROCESSED
      await prisma.paymentEvent.update({
        where: { id: eventRecord.id },
        data: {
          status: "PROCESSED",
          processedAt: new Date(),
        },
      });
    }

    return {
      received: true,
      duplicate: false,
      processed: true,
      eventId: params.eventId,
    };
  }
}

export const paymentService = new PaymentService();
