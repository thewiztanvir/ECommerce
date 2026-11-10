/**
 * Integration Test Suite: Checkout, Payment Engine & Order State Machine
 * Complies with PRD Section 7, Section 8, Section 17.1, 17.3, 17.4, 17.5,
 * ADR-002 (Inventory Reservation), ADR-005 (Identifier Security), and API_CONTRACT_V1.md Section 3.4 & 3.5.
 */

import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { sealSessionData } from "@/modules/auth/session.service";
import { paymentService } from "@/modules/payments/payment.service";

// In-memory cookie jar to simulate session store for test requests
const cookieJar = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => {
      const val = cookieJar.get(name);
      return val !== undefined ? { name, value: val } : undefined;
    },
    set: (nameOrOptions: unknown, value?: unknown) => {
      if (typeof nameOrOptions === "string") {
        cookieJar.set(nameOrOptions, String(value));
      } else if (
        nameOrOptions &&
        typeof nameOrOptions === "object" &&
        "name" in nameOrOptions &&
        "value" in nameOrOptions
      ) {
        cookieJar.set(String(nameOrOptions.name), String(nameOrOptions.value));
      }
    },
    delete: (name: string) => {
      cookieJar.delete(name);
    },
    has: (name: string) => cookieJar.has(name),
  })),
}));

// Route Handlers
import { POST as checkoutRatesRoute } from "@/app/api/v1/checkout/rates/route";
import { POST as checkoutQuoteRoute } from "@/app/api/v1/checkout/quote/route";
import { POST as createOrderRoute } from "@/app/api/v1/checkout/orders/route";
import { POST as checkoutSubmitRoute } from "@/app/api/v1/checkout/route";
import { GET as getOrderRoute } from "@/app/api/v1/orders/[reference]/route";
import { POST as processPaymentRoute } from "@/app/api/v1/payments/process/route";
import { POST as webhookRoute } from "@/app/api/v1/payments/webhook/route";
import { POST as addItemRoute } from "@/app/api/v1/cart/items/route";
import { POST as createCartRoute } from "@/app/api/v1/cart/route";

describe("Integration: Checkout, Payment Engine & Order State Machine", () => {
  let customerA: { id: string; email: string };
  let customerB: { id: string; email: string };
  let authBearerA: string;
  let authBearerB: string;

  let highPriceVariant: { id: string; priceMinor: number; sku: string };
  let lowPriceVariant: { id: string; priceMinor: number; sku: string };

  const sampleAddress = {
    recipientName: "Jane Doe",
    streetLine1: "123 Market Street",
    streetLine2: "Suite 400",
    city: "San Francisco",
    state: "CA",
    postalCode: "94105",
    countryCode: "US",
  };

  beforeAll(async () => {
    // 1. Create Test Customer A
    const userA = await prisma.user.create({
      data: {
        email: `checkout-a-${Date.now()}@example.com`,
        passwordHash: "$2a$12$e8uk7fWf8h4/O2K8B.oU2O8R0M0y9hH/z37p0v61R9D7D.wQe1gC.",
        status: "ACTIVE",
        customerProfile: {
          create: { firstName: "Customer", lastName: "A" },
        },
      },
    });
    customerA = { id: userA.id, email: userA.email };

    authBearerA = await sealSessionData({
      user: {
        id: customerA.id,
        email: customerA.email,
        roles: ["REGISTERED_CUSTOMER"],
      },
      isLoggedIn: true,
    });

    // 2. Create Test Customer B (for authorization check)
    const userB = await prisma.user.create({
      data: {
        email: `checkout-b-${Date.now()}@example.com`,
        passwordHash: "$2a$12$e8uk7fWf8h4/O2K8B.oU2O8R0M0y9hH/z37p0v61R9D7D.wQe1gC.",
        status: "ACTIVE",
        customerProfile: {
          create: { firstName: "Customer", lastName: "B" },
        },
      },
    });
    customerB = { id: userB.id, email: userB.email };

    authBearerB = await sealSessionData({
      user: {
        id: customerB.id,
        email: customerB.email,
        roles: ["REGISTERED_CUSTOMER"],
      },
      isLoggedIn: true,
    });

    // 3. Resolve Sample Seed Variants: High Price (>= $75) and Low Price (< $75)
    const vHigh = await prisma.productVariant.findFirst({
      where: {
        status: "ACTIVE",
        product: { status: "PUBLISHED" },
        prices: { some: { amountMinor: { gte: 7500 } } },
        inventory: { onHandQuantity: { gte: 10 } },
      },
      include: { prices: true, inventory: true },
    });

    const vLow = await prisma.productVariant.findFirst({
      where: {
        status: "ACTIVE",
        product: { status: "PUBLISHED" },
        prices: { some: { amountMinor: { lt: 7500 } } },
        inventory: { onHandQuantity: { gte: 10 } },
      },
      include: { prices: true, inventory: true },
    });

    expect(vHigh).not.toBeNull();
    expect(vLow).not.toBeNull();

    highPriceVariant = {
      id: vHigh!.id,
      priceMinor: vHigh!.prices[0]?.amountMinor ?? 19999,
      sku: vHigh!.sku,
    };

    lowPriceVariant = {
      id: vLow!.id,
      priceMinor: vLow!.prices[0]?.amountMinor ?? 2999,
      sku: vLow!.sku,
    };
  });

  afterAll(async () => {
    // Clean up created test customer records
    await prisma.customerProfile.deleteMany({
      where: { userId: { in: [customerA.id, customerB.id] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [customerA.id, customerB.id] } },
    });
  });

  // =============================================================================
  // 1. Shipping Rates & Checkout Quote
  // =============================================================================
  describe("1. Shipping Rates & Checkout Quote (POST /api/v1/checkout/rates, /quote)", () => {
    it("should calculate standard, express, and overnight shipping rates", async () => {
      // Create cart with low-price variant (< $75)
      cookieJar.clear();
      const cartRes = await createCartRoute(
        new NextRequest("http://localhost:3000/api/v1/cart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        })
      );
      const cartJson = await cartRes.json();
      const cartId = cartJson.data.id;
      const guestToken = cartJson.data.guestCartToken;

      await addItemRoute(
        new NextRequest("http://localhost:3000/api/v1/cart/items", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Guest-Cart-Token": guestToken,
          },
          body: JSON.stringify({ variantId: lowPriceVariant.id, quantity: 1 }),
        })
      );

      // Call shipping rates endpoint
      const ratesRes = await checkoutRatesRoute(
        new NextRequest("http://localhost:3000/api/v1/checkout/rates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cartId,
            shippingAddress: sampleAddress,
          }),
        })
      );
      const ratesJson = await ratesRes.json();

      expect(ratesRes.status).toBe(200);
      const ratesList = ratesJson.data.rates || ratesJson.data;
      expect(Array.isArray(ratesList)).toBe(true);
      expect(ratesList.length).toBe(3);

      const standard = ratesList.find((r: { id: string }) => r.id === "standard");
      const express = ratesList.find((r: { id: string }) => r.id === "express");
      const overnight = ratesList.find((r: { id: string }) => r.id === "overnight");

      expect(standard.amountMinor).toBe(750); // $7.50
      expect(express.amountMinor).toBe(1500); // $15.00
      expect(overnight.amountMinor).toBe(2500); // $25.00
    });

    it("should qualify for free standard shipping when subtotal >= $75.00", async () => {
      cookieJar.clear();
      const cartRes = await createCartRoute(
        new NextRequest("http://localhost:3000/api/v1/cart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        })
      );
      const cartJson = await cartRes.json();
      const cartId = cartJson.data.id;
      const guestToken = cartJson.data.guestCartToken;

      // Add high-price variant (>= $75)
      await addItemRoute(
        new NextRequest("http://localhost:3000/api/v1/cart/items", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Guest-Cart-Token": guestToken,
          },
          body: JSON.stringify({ variantId: highPriceVariant.id, quantity: 1 }),
        })
      );

      const ratesRes = await checkoutRatesRoute(
        new NextRequest("http://localhost:3000/api/v1/checkout/rates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cartId }),
        })
      );
      const ratesJson = await ratesRes.json();

      expect(ratesRes.status).toBe(200);
      const ratesList = ratesJson.data.rates || ratesJson.data;
      const standard = ratesList.find((r: { id: string }) => r.id === "standard");
      expect(standard.amountMinor).toBe(0); // FREE shipping
    });

    it("should calculate authoritative checkout quote via /api/v1/checkout/quote", async () => {
      cookieJar.clear();
      const cartRes = await createCartRoute(
        new NextRequest("http://localhost:3000/api/v1/cart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        })
      );
      const cartJson = await cartRes.json();
      const cartId = cartJson.data.id;
      const guestToken = cartJson.data.guestCartToken;

      await addItemRoute(
        new NextRequest("http://localhost:3000/api/v1/cart/items", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Guest-Cart-Token": guestToken,
          },
          body: JSON.stringify({ variantId: lowPriceVariant.id, quantity: 2 }),
        })
      );

      const quoteRes = await checkoutQuoteRoute(
        new NextRequest("http://localhost:3000/api/v1/checkout/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cartId,
            shippingAddress: sampleAddress,
          }),
        })
      );
      const quoteJson = await quoteRes.json();

      expect(quoteRes.status).toBe(200);
      expect(quoteJson.data.currency).toBe("USD");
      expect(quoteJson.data.subtotalMinor).toBe(lowPriceVariant.priceMinor * 2);
      expect(quoteJson.data.taxMinor).toBeGreaterThan(0);
      expect(quoteJson.data.totalMinor).toBe(
        quoteJson.data.subtotalMinor -
          quoteJson.data.discountMinor +
          quoteJson.data.shippingMinor +
          quoteJson.data.taxMinor
      );
    });

    it("should reject shipping rate calculation with missing cartId (400)", async () => {
      const res = await checkoutRatesRoute(
        new NextRequest("http://localhost:3000/api/v1/checkout/rates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        })
      );
      const json = await res.json();
      expect(res.status).toBe(400);
      expect(json.error.code).toBe("VALIDATION_ERROR");
    });
  });

  // =============================================================================
  // 2. Order Creation & Atomic Inventory Reservation
  // =============================================================================
  describe("2. Order Creation & Inventory Reservation (POST /api/v1/checkout/orders)", () => {
    let createdOrderRef: string;
    let initialOnHand: number;
    let initialReserved: number;

    it("should atomically convert cart into an order with stock reservations and snapshots", async () => {
      // 1. Check initial inventory counts
      const invBefore = await prisma.inventory.findUniqueOrThrow({
        where: { variantId: lowPriceVariant.id },
      });
      initialOnHand = invBefore.onHandQuantity;
      initialReserved = invBefore.reservedQuantity;

      // 2. Create customer cart and add item
      cookieJar.clear();
      const cartRes = await createCartRoute(
        new NextRequest("http://localhost:3000/api/v1/cart", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authBearerA}`,
          },
          body: JSON.stringify({}),
        })
      );
      const cartJson = await cartRes.json();
      const cartId = cartJson.data.id;

      await addItemRoute(
        new NextRequest("http://localhost:3000/api/v1/cart/items", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authBearerA}`,
          },
          body: JSON.stringify({ variantId: lowPriceVariant.id, quantity: 2 }),
        })
      );

      // 3. Create Order
      const idempotencyKey = `test_idemp_${Date.now()}`;
      const orderRes = await createOrderRoute(
        new NextRequest("http://localhost:3000/api/v1/checkout/orders", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authBearerA}`,
            "Idempotency-Key": idempotencyKey,
          },
          body: JSON.stringify({
            cartId,
            shippingAddress: sampleAddress,
            shippingMethodId: "standard",
          }),
        })
      );
      const orderJson = await orderRes.json();

      expect(orderRes.status).toBe(201);
      expect(orderJson.data).toBeDefined();
      expect(orderJson.data.publicReference).toMatch(/^ORD-20\d\d-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/);
      expect(orderJson.data.status).toBe("PENDING_PAYMENT");
      expect(orderJson.data.customerId).toBe(customerA.id);
      expect(orderJson.data.orderItems.length).toBe(1);
      expect(orderJson.data.orderItems[0].quantity).toBe(2);
      expect(orderJson.data.orderAddresses.length).toBe(2); // Shipping & Billing

      createdOrderRef = orderJson.data.publicReference;

      // 4. Verify inventory reserved_quantity was incremented by 2
      const invAfter = await prisma.inventory.findUniqueOrThrow({
        where: { variantId: lowPriceVariant.id },
      });
      expect(invAfter.reservedQuantity).toBe(initialReserved + 2);
      expect(invAfter.onHandQuantity).toBe(initialOnHand); // Not deducted until PAID

      // 5. Verify cart status was marked CONVERTED
      const cartAfter = await prisma.cart.findUniqueOrThrow({
        where: { id: cartId },
      });
      expect(cartAfter.status).toBe("CONVERTED");

      // 6. Test Idempotency-Key replay: Submitting identical key returns same order
      const replayRes = await createOrderRoute(
        new NextRequest("http://localhost:3000/api/v1/checkout/orders", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authBearerA}`,
            "Idempotency-Key": idempotencyKey,
          },
          body: JSON.stringify({
            cartId,
            shippingAddress: sampleAddress,
            shippingMethodId: "standard",
          }),
        })
      );
      const replayJson = await replayRes.json();
      expect(replayRes.status).toBe(201);
      expect(replayJson.data.publicReference).toBe(createdOrderRef);

      // Verify no duplicate reservation was made
      const invAfterReplay = await prisma.inventory.findUniqueOrThrow({
        where: { variantId: lowPriceVariant.id },
      });
      expect(invAfterReplay.reservedQuantity).toBe(initialReserved + 2);
    });

    it("should allow guest checkout when guestEmail is provided", async () => {
      cookieJar.clear();
      const cartRes = await createCartRoute(
        new NextRequest("http://localhost:3000/api/v1/cart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        })
      );
      const cartJson = await cartRes.json();
      const cartId = cartJson.data.id;
      const guestToken = cartJson.data.guestCartToken;

      await addItemRoute(
        new NextRequest("http://localhost:3000/api/v1/cart/items", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Guest-Cart-Token": guestToken,
          },
          body: JSON.stringify({ variantId: lowPriceVariant.id, quantity: 1 }),
        })
      );

      const guestEmail = `guest-${Date.now()}@example.com`;
      const orderRes = await checkoutSubmitRoute(
        new NextRequest("http://localhost:3000/api/v1/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cartId,
            guestEmail,
            shippingAddress: sampleAddress,
            shippingMethodId: "standard",
          }),
        })
      );
      const orderJson = await orderRes.json();

      expect(orderRes.status).toBe(201);
      expect(orderJson.data.guestEmail).toBe(guestEmail);
      expect(orderJson.data.customerId).toBeNull();
    });

    it("should reject guest checkout without email (422 Email Required)", async () => {
      cookieJar.clear();
      const cartRes = await createCartRoute(
        new NextRequest("http://localhost:3000/api/v1/cart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        })
      );
      const cartJson = await cartRes.json();
      const cartId = cartJson.data.id;
      const guestToken = cartJson.data.guestCartToken;

      await addItemRoute(
        new NextRequest("http://localhost:3000/api/v1/cart/items", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Guest-Cart-Token": guestToken,
          },
          body: JSON.stringify({ variantId: lowPriceVariant.id, quantity: 1 }),
        })
      );

      const orderRes = await createOrderRoute(
        new NextRequest("http://localhost:3000/api/v1/checkout/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cartId,
            shippingAddress: sampleAddress,
            shippingMethodId: "standard",
          }),
        })
      );
      const orderJson = await orderRes.json();

      expect(orderRes.status).toBe(422);
      expect(orderJson.error.code).toBe("EMAIL_REQUIRED");
    });
  });

  // =============================================================================
  // 3. Order Detail & Customer Authorization Boundary
  // =============================================================================
  describe("3. Order Detail & Authorization (GET /api/v1/orders/[reference])", () => {
    let customerAOrderRef: string;

    beforeAll(async () => {
      // Create an order for Customer A
      cookieJar.clear();
      const cartRes = await createCartRoute(
        new NextRequest("http://localhost:3000/api/v1/cart", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authBearerA}`,
          },
          body: JSON.stringify({}),
        })
      );
      const cartJson = await cartRes.json();

      await addItemRoute(
        new NextRequest("http://localhost:3000/api/v1/cart/items", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authBearerA}`,
          },
          body: JSON.stringify({ variantId: lowPriceVariant.id, quantity: 1 }),
        })
      );

      const orderRes = await createOrderRoute(
        new NextRequest("http://localhost:3000/api/v1/checkout/orders", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authBearerA}`,
          },
          body: JSON.stringify({
            cartId: cartJson.data.id,
            shippingAddress: sampleAddress,
            shippingMethodId: "standard",
          }),
        })
      );
      const orderJson = await orderRes.json();
      customerAOrderRef = orderJson.data.publicReference;
    });

    it("should retrieve order details by reference for authenticated owner", async () => {
      const res = await getOrderRoute(
        new NextRequest(`http://localhost:3000/api/v1/orders/${customerAOrderRef}`, {
          headers: { Authorization: `Bearer ${authBearerA}` },
        }),
        { params: Promise.resolve({ reference: customerAOrderRef }) }
      );
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.publicReference).toBe(customerAOrderRef);
      expect(json.data.orderItems.length).toBe(1);
      expect(json.data.statusHistory.length).toBeGreaterThan(0);
    });

    it("should prevent Customer B from accessing Customer A's order (403 Forbidden)", async () => {
      const res = await getOrderRoute(
        new NextRequest(`http://localhost:3000/api/v1/orders/${customerAOrderRef}`, {
          headers: { Authorization: `Bearer ${authBearerB}` },
        }),
        { params: Promise.resolve({ reference: customerAOrderRef }) }
      );
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.error.code).toBe("FORBIDDEN");
    });

    it("should return 404 for non-existent order reference", async () => {
      const nonExistent = "ORD-2026-ZZZZZZZZ";
      const res = await getOrderRoute(
        new NextRequest(`http://localhost:3000/api/v1/orders/${nonExistent}`),
        { params: Promise.resolve({ reference: nonExistent }) }
      );
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.error.code).toBe("ORDER_NOT_FOUND");
    });
  });

  // =============================================================================
  // 4. Payment Processing Engine & Test Card Scenarios
  // =============================================================================
  describe("4. Payment Processing Engine (POST /api/v1/payments/process)", () => {
    let targetOrderRef: string;
    let targetVariantId: string;
    let initialOnHand: number;
    let initialReserved: number;

    beforeAll(async () => {
      targetVariantId = lowPriceVariant.id;

      // Create an order in PENDING_PAYMENT
      cookieJar.clear();
      const cartRes = await createCartRoute(
        new NextRequest("http://localhost:3000/api/v1/cart", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authBearerA}`,
          },
          body: JSON.stringify({}),
        })
      );
      const cartJson = await cartRes.json();

      await addItemRoute(
        new NextRequest("http://localhost:3000/api/v1/cart/items", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authBearerA}`,
          },
          body: JSON.stringify({ variantId: targetVariantId, quantity: 2 }),
        })
      );

      const orderRes = await createOrderRoute(
        new NextRequest("http://localhost:3000/api/v1/checkout/orders", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authBearerA}`,
          },
          body: JSON.stringify({
            cartId: cartJson.data.id,
            shippingAddress: sampleAddress,
            shippingMethodId: "standard",
          }),
        })
      );
      const orderJson = await orderRes.json();
      targetOrderRef = orderJson.data.publicReference;

      // Check inventory before payment
      const inv = await prisma.inventory.findUniqueOrThrow({
        where: { variantId: targetVariantId },
      });
      initialOnHand = inv.onHandQuantity;
      initialReserved = inv.reservedQuantity;
    });

    it("should fail payment with test card ending 0002 (Card Declined)", async () => {
      const res = await processPaymentRoute(
        new NextRequest("http://localhost:3000/api/v1/payments/process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderReference: targetOrderRef,
            paymentMethod: {
              type: "card",
              cardNumber: "4000000000000002",
              expMonth: 12,
              expYear: 2028,
              cvc: "123",
            },
          }),
        })
      );
      const json = await res.json();

      expect([400, 402]).toContain(res.status);
      expect(json.error.code).toBe("CARD_DECLINED");

      // Verify order remains PENDING_PAYMENT
      const order = await prisma.order.findUniqueOrThrow({
        where: { publicReference: targetOrderRef },
      });
      expect(order.status).toBe("PENDING_PAYMENT");

      // Verify PaymentAttempt created with status FAILED
      const attempts = await prisma.paymentAttempt.findMany({
        where: { orderId: order.id },
      });
      expect(attempts.some((a) => a.status === "FAILED")).toBe(true);
    });

    it("should fail payment with test card ending 0008 (Insufficient Funds)", async () => {
      const res = await processPaymentRoute(
        new NextRequest("http://localhost:3000/api/v1/payments/process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderReference: targetOrderRef,
            paymentMethod: {
              type: "card",
              cardNumber: "4000000000000008",
              expMonth: 12,
              expYear: 2028,
              cvc: "123",
            },
          }),
        })
      );
      const json = await res.json();

      expect([400, 402]).toContain(res.status);
      expect(json.error.code).toBe("INSUFFICIENT_FUNDS");
    });

    it("should successfully process payment with 4242... test card, transition order to PAID, and commit stock", async () => {
      const res = await processPaymentRoute(
        new NextRequest("http://localhost:3000/api/v1/payments/process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderReference: targetOrderRef,
            paymentMethod: {
              type: "card",
              cardNumber: "4242424242424242",
              expMonth: 12,
              expYear: 2028,
              cvc: "123",
            },
          }),
        })
      );
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.success).toBe(true);
      expect(json.data.status).toBe("PAID");
      expect(json.data.transactionId).toBeDefined();
      expect(json.data.paymentMethod.last4).toBe("4242");
      expect(json.data.paymentMethod.brand).toBe("Visa");

      // 1. Verify Order transitioned to PAID
      const order = await prisma.order.findUniqueOrThrow({
        where: { publicReference: targetOrderRef },
        include: { statusHistory: true, paymentAttempts: true },
      });
      expect(order.status).toBe("PAID");

      // 2. Verify OrderStatusHistory record
      const paidHistory = order.statusHistory.find((h) => h.toStatus === "PAID");
      expect(paidHistory).toBeDefined();
      expect(paidHistory?.source).toBe("PAYMENT_GATEWAY");

      // 3. Verify PaymentAttempt SUCCEEDED
      const successAttempt = order.paymentAttempts.find((a) => a.status === "SUCCEEDED");
      expect(successAttempt).toBeDefined();

      // 4. Verify Inventory Commit: on_hand deducted by 2, reserved decremented by 2
      const invAfter = await prisma.inventory.findUniqueOrThrow({
        where: { variantId: targetVariantId },
      });
      expect(invAfter.onHandQuantity).toBe(initialOnHand - 2);
      expect(invAfter.reservedQuantity).toBe(initialReserved - 2);
    });

    it("should handle idempotent payment calls on an already PAID order", async () => {
      const res = await processPaymentRoute(
        new NextRequest("http://localhost:3000/api/v1/payments/process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderReference: targetOrderRef,
            paymentMethod: {
              type: "card",
              cardNumber: "4242424242424242",
              expMonth: 12,
              expYear: 2028,
              cvc: "123",
            },
          }),
        })
      );
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.success).toBe(true);
      expect(json.data.status).toBe("PAID");
    });
  });

  // =============================================================================
  // 5. Durable Signed Webhooks & Replay Protection
  // =============================================================================
  describe("5. Durable Webhook Receiver (POST /api/v1/payments/webhook)", () => {
    let webhookOrderRef: string;

    beforeAll(async () => {
      // Create an order in PENDING_PAYMENT to be confirmed via Webhook
      cookieJar.clear();
      const cartRes = await createCartRoute(
        new NextRequest("http://localhost:3000/api/v1/cart", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authBearerA}`,
          },
          body: JSON.stringify({}),
        })
      );
      const cartJson = await cartRes.json();

      await addItemRoute(
        new NextRequest("http://localhost:3000/api/v1/cart/items", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authBearerA}`,
          },
          body: JSON.stringify({ variantId: lowPriceVariant.id, quantity: 1 }),
        })
      );

      const orderRes = await createOrderRoute(
        new NextRequest("http://localhost:3000/api/v1/checkout/orders", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authBearerA}`,
          },
          body: JSON.stringify({
            cartId: cartJson.data.id,
            shippingAddress: sampleAddress,
            shippingMethodId: "standard",
          }),
        })
      );
      const orderJson = await orderRes.json();
      webhookOrderRef = orderJson.data.publicReference;
    });

    it("should verify valid HMAC signature and transition order to PAID via webhook", async () => {
      const eventId = `evt_test_${Date.now()}`;
      const payload = {
        id: eventId,
        type: "payment_intent.succeeded",
        provider: "mock",
        orderReference: webhookOrderRef,
        amountMinor: 2999,
        status: "SUCCEEDED",
      };
      const rawBody = JSON.stringify(payload);
      const signature = paymentService.generateWebhookSignature(rawBody);

      const res = await webhookRoute(
        new NextRequest("http://localhost:3000/api/v1/payments/webhook", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-mock-signature": signature,
          },
          body: rawBody,
        })
      );
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.received).toBe(true);
      expect(json.duplicate).toBe(false);
      expect(json.eventId).toBe(eventId);

      // Verify order transitioned to PAID via WEBHOOK
      const order = await prisma.order.findUniqueOrThrow({
        where: { publicReference: webhookOrderRef },
        include: { statusHistory: true },
      });
      expect(order.status).toBe("PAID");
      expect(order.statusHistory.some((h) => h.source === "WEBHOOK")).toBe(true);
    });

    it("should enforce replay protection: duplicate eventId returns duplicate=true without re-processing", async () => {
      const eventId = `evt_dedup_${Date.now()}`;
      const payload = {
        id: eventId,
        type: "payment_intent.succeeded",
        provider: "mock",
        orderReference: webhookOrderRef,
      };
      const rawBody = JSON.stringify(payload);
      const signature = paymentService.generateWebhookSignature(rawBody);

      // 1. First Submission: Processed normally
      const res1 = await webhookRoute(
        new NextRequest("http://localhost:3000/api/v1/payments/webhook", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-mock-signature": signature,
          },
          body: rawBody,
        })
      );
      const json1 = await res1.json();
      expect(res1.status).toBe(200);
      expect(json1.duplicate).toBe(false);

      // 2. Second Submission with identical eventId: Deduplicated
      const res2 = await webhookRoute(
        new NextRequest("http://localhost:3000/api/v1/payments/webhook", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-mock-signature": signature,
          },
          body: rawBody,
        })
      );
      const json2 = await res2.json();
      expect(res2.status).toBe(200);
      expect(json2.received).toBe(true);
      expect(json2.duplicate).toBe(true);
    });

    it("should reject webhook request with forged or invalid signature (401 Unauthorized)", async () => {
      const payload = {
        id: `evt_forged_${Date.now()}`,
        type: "payment_intent.succeeded",
      };
      const rawBody = JSON.stringify(payload);

      const res = await webhookRoute(
        new NextRequest("http://localhost:3000/api/v1/payments/webhook", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-mock-signature": "forged_invalid_signature_hex_12345678",
          },
          body: rawBody,
        })
      );
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.error.code).toBe("INVALID_SIGNATURE");
    });
  });
});
