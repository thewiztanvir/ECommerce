/**
 * Payment Processing & Webhook Inbox Domain Service
 * Complies with PRD Section 7.3, Section 8.2, Section 17.3, Section 23.2,
 * and API_CONTRACT_V1.md Section 3.5.
 */

import { prisma } from "../../lib/db";
import { commitInventoryReservation } from "../../lib/db";
import { hashToken } from "../../lib/crypto";
import { nanoid } from "nanoid";

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

export interface ProcessPaymentParams {
  orderReference: string;
  paymentMethod: {
    type?: string;
    cardNumber: string;
    expMonth: number;
    expYear: number;
    cvc: string;
  };
  idempotencyKey?: string;
}

export interface PaymentResult {
  success: boolean;
  status: "PAID" | "FAILED" | "PENDING_PAYMENT";
  orderReference: string;
  attemptId: string;
  providerTransactionId?: string | null;
  errorDetails?: string | null;
}

export interface WebhookResult {
  received: boolean;
  deduplicated: boolean;
  eventId: string;
  status: string;
}

export class PaymentService {
  /**
   * Process payment attempt for an order.
   * - Test decline rule: Cards ending in "0002" are declined.
   * - Succeeded card: Order transitions to PAID, stock reservation is committed, OrderStatusHistory is logged.
   * - Declined card: PaymentAttempt is recorded as FAILED, order remains PENDING_PAYMENT.
   */
  async processPayment(params: ProcessPaymentParams): Promise<PaymentResult> {
    const order = await prisma.order.findFirst({
      where: {
        OR: [
          { publicReference: params.orderReference },
          { id: params.orderReference },
        ],
      },
      include: {
        orderItems: true,
        paymentAttempts: { orderBy: { createdAt: "desc" } },
      },
    });

    if (!order) {
      throw new PaymentError("ORDER_NOT_FOUND", "The specified order was not found.", 404);
    }

    if (order.status === "PAID") {
      const lastSuccess = order.paymentAttempts.find((p) => p.status === "SUCCEEDED");
      return {
        success: true,
        status: "PAID",
        orderReference: order.publicReference,
        attemptId: lastSuccess?.id ?? "already_paid",
        providerTransactionId: lastSuccess?.providerTransactionId ?? null,
      };
    }

    if (order.status !== "PENDING_PAYMENT") {
      throw new PaymentError(
        "INVALID_ORDER_STATE",
        `Order is in '${order.status}' status and cannot accept payment.`,
        400
      );
    }

    const cleanCard = params.paymentMethod.cardNumber.replace(/[\s-]/g, "");
    const isDecline = cleanCard.endsWith("0002");

    if (isDecline) {
      const attempt = await prisma.paymentAttempt.create({
        data: {
          orderId: order.id,
          provider: "mock",
          amountMinor: order.totalMinor,
          currency: order.currency,
          status: "FAILED",
          errorDetails: "Card was declined by issuing bank (insufficient funds or blocked).",
        },
      });

      throw new PaymentError(
        "CARD_DECLINED",
        "Your payment card was declined by the issuer.",
        402,
        {
          attemptId: attempt.id,
          status: "FAILED",
          orderStatus: "PENDING_PAYMENT",
          reason: "CARD_DECLINED",
        }
      );
    }

    // Success flow executed atomically
    const transactionId = `txn_${nanoid(16)}`;

    const { attempt } = await prisma.$transaction(async (tx) => {
      // 1. Record successful payment attempt
      const paymentAttempt = await tx.paymentAttempt.create({
        data: {
          orderId: order.id,
          provider: "mock",
          providerTransactionId: transactionId,
          amountMinor: order.totalMinor,
          currency: order.currency,
          status: "SUCCEEDED",
        },
      });

      // 2. Transition Order to PAID
      await tx.order.update({
        where: { id: order.id },
        data: { status: "PAID" },
      });

      // 3. Log OrderStatusHistory entry
      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: "PAID",
          source: "SYSTEM",
          reason: "Payment authorized and captured successfully via card provider",
        },
      });

      // 4. Commit Inventory Reservations (deducts on-hand and reserved quantity)
      for (const item of order.orderItems) {
        await commitInventoryReservation(tx, item.variantId, item.quantity);
      }

      // 5. Update InventoryReservation records to COMMITTED
      await tx.inventoryReservation.updateMany({
        where: {
          orderId: order.id,
          status: "ACTIVE",
        },
        data: { status: "COMMITTED" },
      });

      return { attempt: paymentAttempt };
    });

    return {
      success: true,
      status: "PAID",
      orderReference: order.publicReference,
      attemptId: attempt.id,
      providerTransactionId: transactionId,
    };
  }

  /**
   * Durable Webhook Event Receiver with replay protection.
   * If an event with (provider, eventId) was already received, returns deduplicated acknowledgment.
   */
  async handleWebhook(params: {
    provider: string;
    eventId: string;
    eventType?: string;
    orderReference?: string;
    status?: "SUCCEEDED" | "FAILED";
    payload?: unknown;
  }): Promise<WebhookResult> {
    const { provider, eventId } = params;

    // Check for duplicate delivery (replay protection)
    const existing = await prisma.paymentEvent.findUnique({
      where: {
        provider_eventId: {
          provider,
          eventId,
        },
      },
    });

    if (existing) {
      return {
        received: true,
        deduplicated: true,
        eventId,
        status: existing.status,
      };
    }

    const payloadObj = params.payload || params;
    const payloadJson = JSON.stringify(payloadObj);
    const payloadHash = hashToken(payloadJson);

    // Persist to durable inbox
    const event = await prisma.paymentEvent.create({
      data: {
        provider,
        eventId,
        payloadHash,
        payloadJson,
        status: "RECEIVED",
      },
    });

    // Check if event indicates payment success
    const isSuccess =
      params.status === "SUCCEEDED" ||
      params.eventType === "payment_intent.succeeded" ||
      params.eventType === "charge.succeeded";

    if (isSuccess && params.orderReference) {
      const order = await prisma.order.findFirst({
        where: {
          OR: [
            { publicReference: params.orderReference },
            { id: params.orderReference },
          ],
        },
        include: { orderItems: true },
      });

      if (order && order.status === "PENDING_PAYMENT") {
        await prisma.$transaction(async (tx) => {
          await tx.paymentAttempt.create({
            data: {
              orderId: order.id,
              provider,
              providerTransactionId: `webhook_${eventId}`,
              amountMinor: order.totalMinor,
              currency: order.currency,
              status: "SUCCEEDED",
            },
          });

          await tx.order.update({
            where: { id: order.id },
            data: { status: "PAID" },
          });

          await tx.orderStatusHistory.create({
            data: {
              orderId: order.id,
              fromStatus: order.status,
              toStatus: "PAID",
              source: "WEBHOOK",
              reason: `Payment confirmed via ${provider} webhook (${eventId})`,
            },
          });

          for (const item of order.orderItems) {
            await commitInventoryReservation(tx, item.variantId, item.quantity);
          }

          await tx.inventoryReservation.updateMany({
            where: {
              orderId: order.id,
              status: "ACTIVE",
            },
            data: { status: "COMMITTED" },
          });
        });
      }
    }

    await prisma.paymentEvent.update({
      where: { id: event.id },
      data: {
        status: "PROCESSED",
        processedAt: new Date(),
      },
    });

    return {
      received: true,
      deduplicated: false,
      eventId,
      status: "PROCESSED",
    };
  }
}

export const paymentService = new PaymentService();
