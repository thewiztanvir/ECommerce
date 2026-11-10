/**
 * Integration Test Suite: Payment Processing, Card Decline/Success & Webhook Replay Protection
 *
 * Covers:
 * 1. Card success transitions order to PAID, commits inventory reservations, logs OrderStatusHistory.
 * 2. Card decline (4000...0002) records failed payment attempt, leaves order PENDING_PAYMENT.
 * 3. Payment webhook delivery transitions order to PAID.
 * 4. Webhook replay protection: Duplicate delivery of identical eventId is deduplicated.
 *
 * Complies with PRD Section 7.3, Section 8.2, Section 17.5,
 * Section 23.2 Critical Scenarios #7, #8, #10, and API_CONTRACT_V1.md Section 3.5.
 */

import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { authService } from "@/modules/auth/auth.service";
import { cartService } from "@/modules/cart/cart.service";
import { checkoutService } from "@/modules/checkout/checkout.service";
import { generateIdempotencyKey } from "@/lib/identifiers";

// Route Handlers
import { POST as processPaymentRoute } from "@/app/api/v1/payments/process/route";
import { POST as webhookRoute } from "@/app/api/v1/payments/webhooks/[provider]/route";

describe("Payment Processing & Webhook Inbox Integration Suite", () => {
  let customerUser: { id: string; email: string };
  let testVariant: { id: string; sku: string; priceMinor: number };

  const createdOrderIds: string[] = [];
  const createdCartIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdEventIds: string[] = [];

  const sampleAddress = {
    recipientName: "Alex Mercer",
    streetLine1: "789 Mission Street",
    city: "San Francisco",
    state: "CA",
    postalCode: "94103",
    countryCode: "US",
  };

  beforeAll(async () => {
    // 1. Create Customer
    const email = `pay-cust-${Date.now()}@example.com`;
    const user = await authService.register({
      email,
      password: "PaymentPassword#2026",
      firstName: "Payment",
      lastName: "Tester",
    });
    customerUser = { id: user.id, email: user.email };
    createdUserIds.push(user.id);

    // 2. Resolve Test Variant with ample stock
    const variant = await prisma.productVariant.findFirstOrThrow({
      where: {
        status: "ACTIVE",
        product: { status: "PUBLISHED" },
        inventory: { onHandQuantity: { gte: 20 } },
      },
      include: { prices: true, inventory: true },
    });
    testVariant = {
      id: variant.id,
      sku: variant.sku,
      priceMinor: variant.prices[0]?.amountMinor ?? 6500,
    };

    // Ensure clean inventory baseline for test variant
    await prisma.inventory.update({
      where: { variantId: variant.id },
      data: { reservedQuantity: 0 },
    });
  });

  afterAll(async () => {
    // Teardown
    if (createdEventIds.length > 0) {
      await prisma.paymentEvent.deleteMany({
        where: { eventId: { in: createdEventIds } },
      });
    }

    if (createdOrderIds.length > 0) {
      await prisma.orderStatusHistory.deleteMany({
        where: { orderId: { in: createdOrderIds } },
      });
      await prisma.orderAddress.deleteMany({
        where: { orderId: { in: createdOrderIds } },
      });
      await prisma.orderItem.deleteMany({
        where: { orderId: { in: createdOrderIds } },
      });
      await prisma.paymentAttempt.deleteMany({
        where: { orderId: { in: createdOrderIds } },
      });
      await prisma.inventoryReservation.deleteMany({
        where: { orderId: { in: createdOrderIds } },
      });
      await prisma.order.deleteMany({
        where: { id: { in: createdOrderIds } },
      });
    }

    if (createdCartIds.length > 0) {
      await prisma.cartItem.deleteMany({
        where: { cartId: { in: createdCartIds } },
      });
      await prisma.cart.deleteMany({
        where: { id: { in: createdCartIds } },
      });
    }

    if (createdUserIds.length > 0) {
      await prisma.customerProfile.deleteMany({
        where: { userId: { in: createdUserIds } },
      });
      await prisma.userRole.deleteMany({
        where: { userId: { in: createdUserIds } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: createdUserIds } },
      });
    }
  });

  // Helper to create an order ready for payment
  async function setupPendingOrder(quantity: number = 2) {
    const cart = await cartService.getOrCreateCart({ guestToken: `pay-cart-${Date.now()}-${Math.random()}` });
    createdCartIds.push(cart.id);

    await cartService.addItem(cart.id, {
      variantId: testVariant.id,
      quantity,
    });

    const order = await checkoutService.createOrderFromCart({
      cartId: cart.id,
      guestEmail: customerUser.email,
      customerId: customerUser.id,
      shippingAddress: sampleAddress,
      shippingMethodId: "standard",
      idempotencyKey: generateIdempotencyKey(),
    });
    createdOrderIds.push(order.id);

    return { cart, order, quantity };
  }

  // ===========================================================================
  // 1. Payment Processing — Card Success Flow
  // ===========================================================================
  describe("1. Card Success Processing (PRD Section 7.3, 8.2)", () => {
    it("should successfully authorize & capture card payment, transition order to PAID, and commit stock", async () => {
      const { order, quantity } = await setupPendingOrder(2);

      // Check inventory state before payment
      const invBefore = await prisma.inventory.findUniqueOrThrow({
        where: { variantId: testVariant.id },
      });
      const onHandBefore = invBefore.onHandQuantity;
      const reservedBefore = invBefore.reservedQuantity;

      // Submit valid credit card
      const req = new NextRequest("http://localhost:3000/api/v1/payments/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderReference: order.publicReference,
          paymentMethod: {
            type: "card",
            cardNumber: "4242424242424242", // Valid test card
            expMonth: 12,
            expYear: 2028,
            cvc: "123",
          },
        }),
      });

      const res = await processPaymentRoute(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.success).toBe(true);
      expect(json.data.status).toBe("PAID");
      expect(json.data.orderReference).toBe(order.publicReference);
      expect(json.data.attemptId).toBeDefined();
      expect(json.data.providerTransactionId).toMatch(/^txn_/);

      // 1. Verify Order status in DB is PAID
      const dbOrder = await prisma.order.findUniqueOrThrow({
        where: { id: order.id },
        include: {
          paymentAttempts: true,
          statusHistory: { orderBy: { createdAt: "desc" } },
        },
      });
      expect(dbOrder.status).toBe("PAID");

      // 2. Verify OrderStatusHistory audit log entry
      expect(dbOrder.statusHistory.length).toBeGreaterThanOrEqual(2);
      const latestHistory = dbOrder.statusHistory[0];
      expect(latestHistory.fromStatus).toBe("PENDING_PAYMENT");
      expect(latestHistory.toStatus).toBe("PAID");
      expect(latestHistory.source).toBe("PAYMENT_GATEWAY");

      // 3. Verify PaymentAttempt recorded as SUCCEEDED
      const successAttempt = dbOrder.paymentAttempts.find(
        (p) => p.status === "SUCCEEDED"
      );
      expect(successAttempt).toBeDefined();
      expect(successAttempt?.amountMinor).toBe(order.totalMinor);

      // 4. Verify Stock Commitment: on_hand reduced by 2, reserved reduced by 2
      const invAfter = await prisma.inventory.findUniqueOrThrow({
        where: { variantId: testVariant.id },
      });
      expect(invAfter.onHandQuantity).toBe(onHandBefore - quantity);
      expect(invAfter.reservedQuantity).toBe(reservedBefore - quantity);

      // 5. Verify InventoryReservation marked COMMITTED
      const reservation = await prisma.inventoryReservation.findFirst({
        where: { orderId: order.id },
      });
      expect(reservation?.status).toBe("COMMITTED");
    });
  });

  // ===========================================================================
  // 2. Payment Processing — Card Decline Flow (4000...0002)
  // ===========================================================================
  describe("2. Card Decline Handling (PRD Section 7.3, Sec 23.2 #10)", () => {
    it("should decline card ending in 0002, record FAILED payment attempt, and keep order PENDING_PAYMENT", async () => {
      const { order, quantity } = await setupPendingOrder(1);

      const invBefore = await prisma.inventory.findUniqueOrThrow({
        where: { variantId: testVariant.id },
      });

      // Submit decline test card (ends in 0002)
      const req = new NextRequest("http://localhost:3000/api/v1/payments/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderReference: order.publicReference,
          paymentMethod: {
            type: "card",
            cardNumber: "4000000000000002", // Test decline card
            expMonth: 10,
            expYear: 2027,
            cvc: "456",
          },
        }),
      });

      const res = await processPaymentRoute(req);
      const json = await res.json();

      expect(res.status).toBe(402); // 402 Payment Required
      expect(json.error.code).toBe("CARD_DECLINED");
      expect(json.error.message).toContain("declined");

      // 1. Verify Order remains PENDING_PAYMENT
      const dbOrder = await prisma.order.findUniqueOrThrow({
        where: { id: order.id },
        include: { paymentAttempts: true },
      });
      expect(dbOrder.status).toBe("PENDING_PAYMENT");

      // 2. Verify PaymentAttempt recorded as FAILED
      const failedAttempt = dbOrder.paymentAttempts.find(
        (p) => p.status === "FAILED"
      );
      expect(failedAttempt).toBeDefined();
      expect(failedAttempt?.errorDetails).toContain("declined");

      // 3. Verify Stock was NOT committed
      const invAfter = await prisma.inventory.findUniqueOrThrow({
        where: { variantId: testVariant.id },
      });
      expect(invAfter.onHandQuantity).toBe(invBefore.onHandQuantity);
      expect(invAfter.reservedQuantity).toBe(invBefore.reservedQuantity);
    });
  });

  // ===========================================================================
  // 3. Webhook Processing & Replay Protection (Deduplication)
  // ===========================================================================
  describe("3. Webhook Replay Protection (PRD Section 17.5, Sec 23.2 #7, #8)", () => {
    it("should process payment webhook, transition order to PAID, and commit stock", async () => {
      const { order, quantity } = await setupPendingOrder(1);
      const uniqueEventId = `evt_test_${Date.now()}_1`;
      createdEventIds.push(uniqueEventId);

      const invBefore = await prisma.inventory.findUniqueOrThrow({
        where: { variantId: testVariant.id },
      });

      const webhookReq = new NextRequest(
        "http://localhost:3000/api/v1/payments/webhooks/mock",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventId: uniqueEventId,
            eventType: "payment_intent.succeeded",
            orderReference: order.publicReference,
            status: "SUCCEEDED",
          }),
        }
      );

      const res = await webhookRoute(webhookReq, {
        params: Promise.resolve({ provider: "mock" }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.received).toBe(true);
      expect(json.data.deduplicated).toBe(false); // First delivery is NOT deduplicated
      expect(json.data.eventId).toBe(uniqueEventId);

      // Verify Order transitioned to PAID via webhook
      const dbOrder = await prisma.order.findUniqueOrThrow({
        where: { id: order.id },
        include: { statusHistory: { orderBy: { createdAt: "desc" } } },
      });
      expect(dbOrder.status).toBe("PAID");
      expect(dbOrder.statusHistory[0].source).toBe("WEBHOOK");

      // Verify inventory committed
      const invAfter = await prisma.inventory.findUniqueOrThrow({
        where: { variantId: testVariant.id },
      });
      expect(invAfter.onHandQuantity).toBe(invBefore.onHandQuantity - quantity);
    });

    it("should protect against webhook replay: duplicate eventId delivery is deduplicated without re-processing", async () => {
      const uniqueEventId = `evt_test_${Date.now()}_replay`;
      createdEventIds.push(uniqueEventId);

      const payload = {
        eventId: uniqueEventId,
        eventType: "payment_intent.succeeded",
        orderReference: "ORD-2026-DUMMY",
        status: "SUCCEEDED",
      };

      // Delivery 1: Original event
      const req1 = new NextRequest(
        "http://localhost:3000/api/v1/payments/webhooks/mock",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const res1 = await webhookRoute(req1, {
        params: Promise.resolve({ provider: "mock" }),
      });
      const json1 = await res1.json();

      expect(res1.status).toBe(200);
      expect(json1.data.received).toBe(true);
      expect(json1.data.deduplicated).toBe(false);

      // Delivery 2: Exact duplicate webhook (network retry / replay)
      const req2 = new NextRequest(
        "http://localhost:3000/api/v1/payments/webhooks/mock",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const res2 = await webhookRoute(req2, {
        params: Promise.resolve({ provider: "mock" }),
      });
      const json2 = await res2.json();

      // Idempotent acknowledgement
      expect(res2.status).toBe(200);
      expect(json2.data.received).toBe(true);
      expect(json2.data.deduplicated).toBe(true); // Deduplicated!
      expect(json2.data.eventId).toBe(uniqueEventId);

      // Verify ZERO duplicate rows created in payment_events table
      const count = await prisma.paymentEvent.count({
        where: { eventId: uniqueEventId },
      });
      expect(count).toBe(1);
    });
  });
});
