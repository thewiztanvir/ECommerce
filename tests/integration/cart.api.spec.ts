/**
 * Integration Test Suite: Shopping Cart, Guest Cart Merging & Coupon Engine
 * Complies with PRD Section 6.5, Section 7.2, Section 10, Section 17.3,
 * Section 23.2 (Critical Scenarios #1, #2, #4, #5), and API_CONTRACT_V1.md Section 3.3.
 */

import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { MoneyEngine } from "@/lib/money";
import { sealSessionData } from "@/modules/auth/session.service";
import { authService } from "@/modules/auth/auth.service";

// In-memory cookie jar to simulate session store for test requests
const cookieJar = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => {
      const val = cookieJar.get(name);
      return val !== undefined ? { name, value: val } : undefined;
    },
    set: (nameOrOptions: any, value?: any) => {
      if (typeof nameOrOptions === "string") {
        cookieJar.set(nameOrOptions, value);
      } else if (nameOrOptions && typeof nameOrOptions === "object") {
        cookieJar.set(nameOrOptions.name, nameOrOptions.value);
      }
    },
    delete: (name: string) => {
      cookieJar.delete(name);
    },
    has: (name: string) => cookieJar.has(name),
  })),
}));

// Route Handlers
import { GET as getCartRoute, POST as createOrGetCartRoute } from "@/app/api/v1/cart/route";
import { POST as addItemRoute } from "@/app/api/v1/cart/items/route";
import {
  PATCH as updateItemRoute,
  DELETE as removeItemRoute,
} from "@/app/api/v1/cart/items/[id]/route";
import {
  POST as applyCouponRoute,
  DELETE as removeCouponRoute,
} from "@/app/api/v1/cart/coupon/route";
import { POST as mergeCartRoute } from "@/app/api/v1/cart/merge/route";
import { POST as loginRoute } from "@/app/api/v1/auth/login/route";

describe("Integration: Shopping Cart & Coupon Engine APIs", () => {
  let testUser: { id: string; email: string };
  let authBearerToken: string;
  let loginTestUser: { id: string; email: string; passwordRaw: string };
  let testVariant1: { id: string; priceMinor: number; sku: string };
  let testVariant2: { id: string; priceMinor: number; sku: string };
  let lowStockVariant: { id: string; availableStock: number; sku: string };
  let outOfStockVariant: { id: string; sku: string };

  beforeAll(async () => {
    // 1. Create Test Customer
    const testEmail = `cart-tester-${Date.now()}@example.com`;
    const userRecord = await prisma.user.create({
      data: {
        email: testEmail,
        passwordHash: "$2a$12$e8uk7fWf8h4/O2K8B.oU2O8R0M0y9hH/z37p0v61R9D7D.wQe1gC.",
        status: "ACTIVE",
        customerProfile: {
          create: {
            firstName: "Cart",
            lastName: "Tester",
          },
        },
      },
    });
    testUser = { id: userRecord.id, email: userRecord.email };

    // 2. Generate Encrypted Auth Bearer Token for tests
    authBearerToken = await sealSessionData({
      user: {
        id: testUser.id,
        email: testUser.email,
        roles: ["REGISTERED_CUSTOMER"],
      },
      isLoggedIn: true,
    });

    // 3. Create Login Test Customer with known plain password for login merge test
    loginTestUser = {
      id: "",
      email: `cart-login-${Date.now()}@example.com`,
      passwordRaw: "CartLogin#2026",
    };
    const regUser = await authService.register({
      email: loginTestUser.email,
      password: loginTestUser.passwordRaw,
      firstName: "Login",
      lastName: "Customer",
    });
    loginTestUser.id = regUser.id;

    // 4. Resolve Sample Seed Variants: High-Price (>= $75) and Low-Price (< $75)
    const v1 = await prisma.productVariant.findFirst({
      where: {
        status: "ACTIVE",
        product: { status: "PUBLISHED" },
        prices: { some: { amountMinor: { gte: 7500 } } },
        inventory: { onHandQuantity: { gte: 10 } },
      },
      include: { prices: true, inventory: true },
    });

    const v2 = await prisma.productVariant.findFirst({
      where: {
        status: "ACTIVE",
        product: { status: "PUBLISHED" },
        prices: { some: { amountMinor: { lt: 7500 } } },
        inventory: { onHandQuantity: { gte: 10 } },
      },
      include: { prices: true, inventory: true },
    });

    expect(v1).not.toBeNull();
    expect(v2).not.toBeNull();

    testVariant1 = {
      id: v1!.id,
      priceMinor: v1!.prices[0]?.amountMinor ?? 19999,
      sku: v1!.sku,
    };

    testVariant2 = {
      id: v2!.id,
      priceMinor: v2!.prices[0]?.amountMinor ?? 2999,
      sku: v2!.sku,
    };

    // 5. Resolve Low Stock Variant (stock <= 3) and Out of Stock Variant (stock = 0)
    const lowStock = await prisma.productVariant.findFirst({
      where: {
        status: "ACTIVE",
        product: { status: "PUBLISHED" },
        inventory: { onHandQuantity: { gt: 0, lte: 3 } },
      },
      include: { inventory: true },
    });

    if (lowStock) {
      lowStockVariant = {
        id: lowStock.id,
        availableStock:
          (lowStock.inventory?.onHandQuantity ?? 0) -
          (lowStock.inventory?.reservedQuantity ?? 0),
        sku: lowStock.sku,
      };
    } else {
      lowStockVariant = {
        id: testVariant1.id,
        availableStock: 10,
        sku: testVariant1.sku,
      };
    }

    const outOfStock = await prisma.productVariant.findFirst({
      where: {
        status: "ACTIVE",
        product: { status: "PUBLISHED" },
        inventory: { onHandQuantity: 0 },
      },
    });

    if (outOfStock) {
      outOfStockVariant = {
        id: outOfStock.id,
        sku: outOfStock.sku,
      };
    } else {
      outOfStockVariant = {
        id: "no-stock-dummy",
        sku: "DUMMY-OUT",
      };
    }
  });

  afterAll(async () => {
    // Clean up test customer and their carts
    const userIds = [testUser?.id, loginTestUser?.id].filter(Boolean);
    if (userIds.length > 0) {
      const carts = await prisma.cart.findMany({
        where: { customerId: { in: userIds } },
        select: { id: true },
      });
      const cartIds = carts.map((c) => c.id);
      if (cartIds.length > 0) {
        await prisma.cartItem.deleteMany({ where: { cartId: { in: cartIds } } });
        await prisma.cart.deleteMany({ where: { id: { in: cartIds } } });
      }
      await prisma.customerProfile.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.userRole.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
  });

  // ===========================================================================
  // 1. Cart Resolution & Token Initialization
  // ===========================================================================
  describe("1. Cart Initialization (GET & POST /api/v1/cart)", () => {
    it("should initialize a new guest cart and return X-Guest-Cart-Token header", async () => {
      cookieJar.clear();
      const req = new NextRequest("http://localhost:3000/api/v1/cart");
      const res = await getCartRoute(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.id).toBeDefined();
      expect(json.data.status).toBe("ACTIVE");
      expect(json.data.guestCartToken).toBeDefined();
      expect(typeof json.data.guestCartToken).toBe("string");
      expect(json.data.guestCartToken.length).toBe(64);
      expect(json.data.items).toEqual([]);
      expect(json.data.summary.itemCount).toBe(0);
      expect(json.data.summary.subtotalMinor).toBe(0);

      // Verify response header contains X-Guest-Cart-Token
      expect(res.headers.get("x-guest-cart-token")).toBe(json.data.guestCartToken);
    });

    it("should retrieve existing guest cart when X-Guest-Cart-Token header is provided", async () => {
      cookieJar.clear();
      // 1. Create first
      const createRes = await getCartRoute(new NextRequest("http://localhost:3000/api/v1/cart"));
      const createJson = await createRes.json();
      const guestToken = createJson.data.guestCartToken;

      // 2. Fetch using token header
      const fetchReq = new NextRequest("http://localhost:3000/api/v1/cart", {
        headers: { "X-Guest-Cart-Token": guestToken },
      });
      const fetchRes = await getCartRoute(fetchReq);
      const fetchJson = await fetchRes.json();

      expect(fetchRes.status).toBe(200);
      expect(fetchJson.data.id).toBe(createJson.data.id);
    });

    it("should resolve customer cart when authenticated via Bearer token", async () => {
      cookieJar.clear();
      const req = new NextRequest("http://localhost:3000/api/v1/cart", {
        headers: { Authorization: `Bearer ${authBearerToken}` },
      });
      const res = await getCartRoute(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.id).toBeDefined();
      expect(json.data.customerId).toBe(testUser.id);
    });
  });

  // ===========================================================================
  // 2. Cart Item Management (Add, Update, Remove, Stock Checks)
  // ===========================================================================
  describe("2. Cart Item Management (POST, PATCH, DELETE /api/v1/cart/items)", () => {
    let guestToken: string;
    let addedItemId: string;

    beforeAll(async () => {
      cookieJar.clear();
      const initRes = await getCartRoute(new NextRequest("http://localhost:3000/api/v1/cart"));
      const json = await initRes.json();
      guestToken = json.data.guestCartToken;
    });

    it("should add a product variant to the cart (POST /api/v1/cart/items)", async () => {
      const req = new NextRequest("http://localhost:3000/api/v1/cart/items", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Guest-Cart-Token": guestToken,
        },
        body: JSON.stringify({
          variantId: testVariant1.id,
          quantity: 1,
        }),
      });

      const res = await addItemRoute(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.items.length).toBe(1);
      expect(json.data.items[0].variantId).toBe(testVariant1.id);
      expect(json.data.items[0].quantity).toBe(1);
      expect(json.data.items[0].unitPriceMinor).toBe(testVariant1.priceMinor);
      expect(json.data.summary.subtotalMinor).toBe(testVariant1.priceMinor);

      addedItemId = json.data.items[0].id;
    });

    it("should increment quantity when adding the same variant again", async () => {
      const req = new NextRequest("http://localhost:3000/api/v1/cart/items", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Guest-Cart-Token": guestToken,
        },
        body: JSON.stringify({
          variantId: testVariant1.id,
          quantity: 2,
        }),
      });

      const res = await addItemRoute(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.items.length).toBe(1);
      expect(json.data.items[0].quantity).toBe(3); // 1 + 2 = 3
      expect(json.data.summary.itemCount).toBe(3);
      expect(json.data.summary.subtotalMinor).toBe(testVariant1.priceMinor * 3);
    });

    it("should reject adding more units than available in stock (409 INSUFFICIENT_STOCK)", async () => {
      if (lowStockVariant.availableStock > 0 && lowStockVariant.availableStock < 10) {
        const req = new NextRequest("http://localhost:3000/api/v1/cart/items", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Guest-Cart-Token": guestToken,
          },
          body: JSON.stringify({
            variantId: lowStockVariant.id,
            quantity: lowStockVariant.availableStock + 5, // Exceed stock
          }),
        });

        const res = await addItemRoute(req);
        const json = await res.json();

        expect(res.status).toBe(409);
        expect(json.error.code).toBe("INSUFFICIENT_STOCK");
      }
    });

    it("should reject adding out-of-stock variant (409 INSUFFICIENT_STOCK)", async () => {
      if (outOfStockVariant.id !== "no-stock-dummy") {
        const req = new NextRequest("http://localhost:3000/api/v1/cart/items", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Guest-Cart-Token": guestToken,
          },
          body: JSON.stringify({
            variantId: outOfStockVariant.id,
            quantity: 1,
          }),
        });

        const res = await addItemRoute(req);
        const json = await res.json();

        expect(res.status).toBe(409);
        expect(json.error.code).toBe("INSUFFICIENT_STOCK");
      }
    });

    it("should reject adding more than 10 units of a variant (purchase limit)", async () => {
      const req = new NextRequest("http://localhost:3000/api/v1/cart/items", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Guest-Cart-Token": guestToken,
        },
        body: JSON.stringify({
          variantId: testVariant1.id,
          quantity: 9, // Currently 3 in cart; 3 + 9 = 12 > 10 limit
        }),
      });

      const res = await addItemRoute(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error.code).toBe("PURCHASE_LIMIT_EXCEEDED");
    });

    it("should reject non-existent variant ID with 404", async () => {
      const req = new NextRequest("http://localhost:3000/api/v1/cart/items", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Guest-Cart-Token": guestToken,
        },
        body: JSON.stringify({
          variantId: "non_existent_variant_cuid",
          quantity: 1,
        }),
      });

      const res = await addItemRoute(req);
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.error.code).toBe("VARIANT_NOT_FOUND");
    });

    it("should update line item quantity (PATCH /api/v1/cart/items/[id])", async () => {
      const req = new NextRequest(`http://localhost:3000/api/v1/cart/items/${addedItemId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-Guest-Cart-Token": guestToken,
        },
        body: JSON.stringify({
          quantity: 5,
        }),
      });

      const res = await updateItemRoute(req, {
        params: Promise.resolve({ id: addedItemId }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.items[0].quantity).toBe(5);
      expect(json.data.summary.itemCount).toBe(5);
      expect(json.data.summary.subtotalMinor).toBe(testVariant1.priceMinor * 5);
    });

    it("should reject updating quantity beyond available inventory (409 INSUFFICIENT_STOCK)", async () => {
      if (lowStockVariant.availableStock > 0 && lowStockVariant.availableStock <= 3) {
        // Add 1 low stock item first
        const addRes = await addItemRoute(
          new NextRequest("http://localhost:3000/api/v1/cart/items", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Guest-Cart-Token": guestToken,
            },
            body: JSON.stringify({
              variantId: lowStockVariant.id,
              quantity: 1,
            }),
          })
        );
        const addJson = await addRes.json();
        const lowStockItemId = addJson.data.items.find(
          (i: { variantId: string }) => i.variantId === lowStockVariant.id
        )?.id;

        if (lowStockItemId) {
          const patchReq = new NextRequest(
            `http://localhost:3000/api/v1/cart/items/${lowStockItemId}`,
            {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                "X-Guest-Cart-Token": guestToken,
              },
              body: JSON.stringify({ quantity: lowStockVariant.availableStock + 4 }),
            }
          );
          const patchRes = await updateItemRoute(patchReq, {
            params: Promise.resolve({ id: lowStockItemId }),
          });
          const patchJson = await patchRes.json();
          expect(patchRes.status).toBe(409);
          expect(patchJson.error.code).toBe("INSUFFICIENT_STOCK");

          // Clean up the low stock item
          await removeItemRoute(
            new NextRequest(`http://localhost:3000/api/v1/cart/items/${lowStockItemId}`, {
              method: "DELETE",
              headers: { "X-Guest-Cart-Token": guestToken },
            }),
            { params: Promise.resolve({ id: lowStockItemId }) }
          );
        }
      }
    });

    it("should remove line item when updating quantity to 0", async () => {
      // Add a second item first
      await addItemRoute(
        new NextRequest("http://localhost:3000/api/v1/cart/items", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Guest-Cart-Token": guestToken,
          },
          body: JSON.stringify({
            variantId: testVariant2.id,
            quantity: 1,
          }),
        })
      );

      // Now set item 1 to quantity 0
      const req = new NextRequest(`http://localhost:3000/api/v1/cart/items/${addedItemId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-Guest-Cart-Token": guestToken,
        },
        body: JSON.stringify({
          quantity: 0,
        }),
      });

      const res = await updateItemRoute(req, {
        params: Promise.resolve({ id: addedItemId }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      // Item 1 was removed; only item 2 remains
      expect(json.data.items.find((i: { id: string }) => i.id === addedItemId)).toBeUndefined();
      expect(json.data.items.length).toBe(1);
    });

    it("should enforce Anti-IDOR: Cart B cannot modify or delete Cart A's item", async () => {
      // 1. Get existing item from Cart A
      const cartARes = await getCartRoute(
        new NextRequest("http://localhost:3000/api/v1/cart", {
          headers: { "X-Guest-Cart-Token": guestToken },
        })
      );
      const cartAJson = await cartARes.json();
      const cartAItemId = cartAJson.data.items[0].id;

      // 2. Initialize a separate Cart B
      const cartBInit = await getCartRoute(new NextRequest("http://localhost:3000/api/v1/cart"));
      const cartBJson = await cartBInit.json();
      const cartBToken = cartBJson.data.guestCartToken;

      // 3. Cart B attempts to delete Cart A's item
      const idorDeleteReq = new NextRequest(
        `http://localhost:3000/api/v1/cart/items/${cartAItemId}`,
        {
          method: "DELETE",
          headers: { "X-Guest-Cart-Token": cartBToken },
        }
      );
      const idorDeleteRes = await removeItemRoute(idorDeleteReq, {
        params: Promise.resolve({ id: cartAItemId }),
      });
      const idorDeleteJson = await idorDeleteRes.json();
      expect(idorDeleteRes.status).toBe(404);
      expect(idorDeleteJson.error.code).toBe("ITEM_NOT_FOUND");

      // 4. Cart B attempts to PATCH Cart A's item
      const idorPatchReq = new NextRequest(
        `http://localhost:3000/api/v1/cart/items/${cartAItemId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "X-Guest-Cart-Token": cartBToken,
          },
          body: JSON.stringify({ quantity: 3 }),
        }
      );
      const idorPatchRes = await updateItemRoute(idorPatchReq, {
        params: Promise.resolve({ id: cartAItemId }),
      });
      const idorPatchJson = await idorPatchRes.json();
      expect(idorPatchRes.status).toBe(404);
      expect(idorPatchJson.error.code).toBe("ITEM_NOT_FOUND");
    });

    it("should remove line item via DELETE /api/v1/cart/items/[id]", async () => {
      const currentRes = await getCartRoute(
        new NextRequest("http://localhost:3000/api/v1/cart", {
          headers: { "X-Guest-Cart-Token": guestToken },
        })
      );
      const currentJson = await currentRes.json();
      const remainingItemId = currentJson.data.items[0].id;

      const req = new NextRequest(`http://localhost:3000/api/v1/cart/items/${remainingItemId}`, {
        method: "DELETE",
        headers: { "X-Guest-Cart-Token": guestToken },
      });

      const res = await removeItemRoute(req, {
        params: Promise.resolve({ id: remainingItemId }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.items.length).toBe(0);
      expect(json.data.summary.itemCount).toBe(0);
      expect(json.data.summary.subtotalMinor).toBe(0);
    });
  });

  // ===========================================================================
  // 3. Authoritative Pricing, Tax & Free Shipping Calculations
  // ===========================================================================
  describe("3. Authoritative Financial Calculations", () => {
    it("should charge $7.50 shipping when subtotal < $75.00", async () => {
      // Create fresh cart
      const initRes = await getCartRoute(new NextRequest("http://localhost:3000/api/v1/cart"));
      const initJson = await initRes.json();
      const guestToken = initJson.data.guestCartToken;

      // Add 1 unit of low price variant (subtotal: priceMinor < 7500)
      const addRes = await addItemRoute(
        new NextRequest("http://localhost:3000/api/v1/cart/items", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Guest-Cart-Token": guestToken,
          },
          body: JSON.stringify({
            variantId: testVariant2.id,
            quantity: 1,
          }),
        })
      );
      const json = await addRes.json();

      expect(json.data.summary.subtotalMinor).toBe(testVariant2.priceMinor);
      expect(json.data.summary.shippingMinor).toBe(750); // $7.50
      expect(json.data.summary.taxMinor).toBe(
        Math.round((testVariant2.priceMinor * 850) / 10000)
      );
      expect(json.data.summary.totalMinor).toBe(
        json.data.summary.subtotalMinor +
          json.data.summary.shippingMinor +
          json.data.summary.taxMinor
      );
    });

    it("should grant free shipping ($0.00) when subtotal >= $75.00", async () => {
      const initRes = await getCartRoute(new NextRequest("http://localhost:3000/api/v1/cart"));
      const initJson = await initRes.json();
      const guestToken = initJson.data.guestCartToken;

      // Add 1 unit of high price variant (subtotal: priceMinor >= 7500)
      const addRes = await addItemRoute(
        new NextRequest("http://localhost:3000/api/v1/cart/items", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Guest-Cart-Token": guestToken,
          },
          body: JSON.stringify({
            variantId: testVariant1.id,
            quantity: 1,
          }),
        })
      );
      const json = await addRes.json();

      expect(json.data.summary.shippingMinor).toBe(0); // Free shipping
    });
  });

  // ===========================================================================
  // 4. Promotional Coupon Engine (POST & DELETE /api/v1/cart/coupon)
  // ===========================================================================
  describe("4. Coupon Engine (POST & DELETE /api/v1/cart/coupon)", () => {
    let guestToken: string;

    beforeAll(async () => {
      const initRes = await getCartRoute(new NextRequest("http://localhost:3000/api/v1/cart"));
      const json = await initRes.json();
      guestToken = json.data.guestCartToken;

      // Add item to cart ($199.99 = 19999 cents or variant1 price)
      await addItemRoute(
        new NextRequest("http://localhost:3000/api/v1/cart/items", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Guest-Cart-Token": guestToken,
          },
          body: JSON.stringify({
            variantId: testVariant1.id,
            quantity: 1,
          }),
        })
      );
    });

    it("should successfully apply percentage discount coupon SAVE10 (10% off)", async () => {
      const req = new NextRequest("http://localhost:3000/api/v1/cart/coupon", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Guest-Cart-Token": guestToken,
        },
        body: JSON.stringify({ couponCode: "save10" }), // Test case-insensitivity
      });

      const res = await applyCouponRoute(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.coupon).toBeDefined();
      expect(json.data.coupon.code).toBe("SAVE10");
      expect(json.data.coupon.type).toBe("PERCENTAGE");

      const expectedDiscount = Math.round((testVariant1.priceMinor * 1000) / 10000);
      expect(json.data.coupon.appliedDiscountMinor).toBe(expectedDiscount);
      expect(json.data.summary.discountMinor).toBe(expectedDiscount);
    });

    it("should successfully apply fixed discount coupon WELCOME20 ($20 off)", async () => {
      const req = new NextRequest("http://localhost:3000/api/v1/cart/coupon", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Guest-Cart-Token": guestToken,
        },
        body: JSON.stringify({ couponCode: "WELCOME20" }),
      });

      const res = await applyCouponRoute(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.coupon.code).toBe("WELCOME20");
      expect(json.data.coupon.type).toBe("FIXED_AMOUNT");
      expect(json.data.coupon.appliedDiscountMinor).toBe(2000); // $20.00 = 2000 cents
      expect(json.data.summary.discountMinor).toBe(2000);
    });

    it("should reject expired coupon EXPIRED50 with 422", async () => {
      const req = new NextRequest("http://localhost:3000/api/v1/cart/coupon", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Guest-Cart-Token": guestToken,
        },
        body: JSON.stringify({ couponCode: "EXPIRED50" }),
      });

      const res = await applyCouponRoute(req);
      const json = await res.json();

      expect(res.status).toBe(422);
      expect(json.error.code).toBe("COUPON_INVALID");
    });

    it("should reject disabled coupon DISABLED15 with 422", async () => {
      const req = new NextRequest("http://localhost:3000/api/v1/cart/coupon", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Guest-Cart-Token": guestToken,
        },
        body: JSON.stringify({ couponCode: "DISABLED15" }),
      });

      const res = await applyCouponRoute(req);
      const json = await res.json();

      expect(res.status).toBe(422);
      expect(json.error.code).toBe("COUPON_INVALID");
    });

    it("should reject non-existent coupon with 422", async () => {
      const req = new NextRequest("http://localhost:3000/api/v1/cart/coupon", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Guest-Cart-Token": guestToken,
        },
        body: JSON.stringify({ couponCode: "FAKE_COUPON_999" }),
      });

      const res = await applyCouponRoute(req);
      const json = await res.json();

      expect(res.status).toBe(422);
      expect(json.error.code).toBe("COUPON_INVALID");
    });

    it("should reject coupon when cart subtotal is below minimum order value", async () => {
      // Create cart with 1 low price variant ($29.99 = 2999 cents)
      const lowCartInit = await getCartRoute(new NextRequest("http://localhost:3000/api/v1/cart"));
      const lowCartJson = await lowCartInit.json();
      const lowToken = lowCartJson.data.guestCartToken;

      await addItemRoute(
        new NextRequest("http://localhost:3000/api/v1/cart/items", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Guest-Cart-Token": lowToken,
          },
          body: JSON.stringify({
            variantId: testVariant2.id, // e.g. 2999 or 3400 cents < 10000 min order for WELCOME20
            quantity: 1,
          }),
        })
      );

      // WELCOME20 requires $100.00 (10000 cents)
      const minReq = new NextRequest("http://localhost:3000/api/v1/cart/coupon", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Guest-Cart-Token": lowToken,
        },
        body: JSON.stringify({ couponCode: "WELCOME20" }),
      });
      const minRes = await applyCouponRoute(minReq);
      const minJson = await minRes.json();

      expect(minRes.status).toBe(422);
      expect(minJson.error.code).toBe("COUPON_INVALID");
      expect(minJson.error.message).toContain("minimum order subtotal of $100.00");
    });

    it("should reject applying coupon to an empty cart", async () => {
      const emptyInit = await getCartRoute(new NextRequest("http://localhost:3000/api/v1/cart"));
      const emptyInitJson = await emptyInit.json();
      const emptyToken = emptyInitJson.data.guestCartToken;

      const emptyReq = new NextRequest("http://localhost:3000/api/v1/cart/coupon", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Guest-Cart-Token": emptyToken,
        },
        body: JSON.stringify({ couponCode: "SAVE10" }),
      });
      const emptyRes = await applyCouponRoute(emptyReq);
      const emptyResJson = await emptyRes.json();

      expect(emptyRes.status).toBe(422);
      expect(emptyResJson.error.code).toBe("COUPON_INVALID");
      expect(emptyResJson.error.message).toContain("empty cart");
    });

    it("should remove applied coupon via DELETE /api/v1/cart/coupon", async () => {
      const req = new NextRequest("http://localhost:3000/api/v1/cart/coupon", {
        method: "DELETE",
        headers: { "X-Guest-Cart-Token": guestToken },
      });

      const res = await removeCouponRoute(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.coupon).toBeNull();
      expect(json.data.summary.discountMinor).toBe(0);
    });
  });

  // ===========================================================================
  // 5. Guest Cart Merging (POST /api/v1/cart/merge & POST /api/v1/auth/login)
  // ===========================================================================
  describe("5. Guest Cart Merging (POST /api/v1/cart/merge & Login FR-CART-007, FR-CART-008)", () => {
    it("should merge guest items and coupon into customer cart upon authentication", async () => {
      // 1. Create a guest cart with items and coupon
      const guestInitRes = await getCartRoute(new NextRequest("http://localhost:3000/api/v1/cart"));
      const guestInitJson = await guestInitRes.json();
      const guestToken = guestInitJson.data.guestCartToken;

      await addItemRoute(
        new NextRequest("http://localhost:3000/api/v1/cart/items", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Guest-Cart-Token": guestToken,
          },
          body: JSON.stringify({
            variantId: testVariant1.id,
            quantity: 2,
          }),
        })
      );

      await applyCouponRoute(
        new NextRequest("http://localhost:3000/api/v1/cart/coupon", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Guest-Cart-Token": guestToken,
          },
          body: JSON.stringify({ couponCode: "SAVE10" }),
        })
      );

      // 2. Perform merge as authenticated customer
      const mergeReq = new NextRequest("http://localhost:3000/api/v1/cart/merge", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authBearerToken}`,
        },
        body: JSON.stringify({ guestCartToken: guestToken }),
      });

      const mergeRes = await mergeCartRoute(mergeReq);
      const mergeJson = await mergeRes.json();

      expect(mergeRes.status).toBe(200);
      expect(mergeJson.data.customerId).toBe(testUser.id);
      expect(mergeJson.data.items.length).toBeGreaterThanOrEqual(1);

      const mergedItem = mergeJson.data.items.find(
        (i: { variantId: string }) => i.variantId === testVariant1.id
      );
      expect(mergedItem).toBeDefined();
      expect(mergedItem.quantity).toBeGreaterThanOrEqual(2);

      // Verify coupon transferred to customer cart
      expect(mergeJson.data.coupon?.code).toBe("SAVE10");

      // Verify guest cart status in DB was updated to MERGED
      const originalGuestCart = await prisma.cart.findUnique({
        where: { id: guestInitJson.data.id },
      });
      expect(originalGuestCart?.status).toBe("MERGED");
    });

    it("should merge guest items into customer cart automatically during login (FR-CART-007)", async () => {
      cookieJar.clear();

      // 1. Create a guest cart with items
      const guestInitRes = await getCartRoute(new NextRequest("http://localhost:3000/api/v1/cart"));
      const guestInitJson = await guestInitRes.json();
      const guestToken = guestInitJson.data.guestCartToken;

      await addItemRoute(
        new NextRequest("http://localhost:3000/api/v1/cart/items", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Guest-Cart-Token": guestToken,
          },
          body: JSON.stringify({
            variantId: testVariant2.id,
            quantity: 2,
          }),
        })
      );

      // 2. Customer logs in passing X-Guest-Cart-Token header
      const loginReq = new NextRequest("http://localhost:3000/api/v1/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Guest-Cart-Token": guestToken,
        },
        body: JSON.stringify({
          email: loginTestUser.email,
          password: loginTestUser.passwordRaw,
        }),
      });

      const loginRes = await loginRoute(loginReq);
      const loginJson = await loginRes.json();

      expect(loginRes.status).toBe(200);
      expect(loginJson.data.user.email).toBe(loginTestUser.email);
      expect(loginJson.data.cartMerged).toBe(true);

      // 3. Customer retrieves active cart using established cookie session
      const getCartRes = await getCartRoute(new NextRequest("http://localhost:3000/api/v1/cart"));
      const getCartJson = await getCartRes.json();

      expect(getCartRes.status).toBe(200);
      expect(getCartJson.data.customerId).toBe(loginTestUser.id);
      expect(getCartJson.data.items.length).toBeGreaterThanOrEqual(1);

      const mergedItem = getCartJson.data.items.find(
        (i: { variantId: string }) => i.variantId === testVariant2.id
      );
      expect(mergedItem).toBeDefined();
      expect(mergedItem.quantity).toBe(2);

      // 4. Verify guest cart status in DB was updated to MERGED
      const originalGuestCart = await prisma.cart.findUnique({
        where: { id: guestInitJson.data.id },
      });
      expect(originalGuestCart?.status).toBe("MERGED");
    });

    it("should aggregate quantities when merging guest cart with existing customer items", async () => {
      // 1. Customer already has testVariant2 in cart (qty: 2 from previous test)
      // 2. Guest creates cart with 1 unit of testVariant2
      cookieJar.clear();
      const guestInitRes = await getCartRoute(new NextRequest("http://localhost:3000/api/v1/cart"));
      const guestInitJson = await guestInitRes.json();
      const guestToken = guestInitJson.data.guestCartToken;

      await addItemRoute(
        new NextRequest("http://localhost:3000/api/v1/cart/items", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Guest-Cart-Token": guestToken,
          },
          body: JSON.stringify({
            variantId: testVariant2.id,
            quantity: 1,
          }),
        })
      );

      // 3. Customer logs in again with the new guestToken
      const loginReq = new NextRequest("http://localhost:3000/api/v1/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Guest-Cart-Token": guestToken,
        },
        body: JSON.stringify({
          email: loginTestUser.email,
          password: loginTestUser.passwordRaw,
        }),
      });

      const loginRes = await loginRoute(loginReq);
      const loginJson = await loginRes.json();
      expect(loginRes.status).toBe(200);
      expect(loginJson.data.cartMerged).toBe(true);

      // 4. Retrieve cart: 2 + 1 = 3 aggregated units without duplicate line items
      const getCartRes = await getCartRoute(new NextRequest("http://localhost:3000/api/v1/cart"));
      const getCartJson = await getCartRes.json();

      const mergedItem = getCartJson.data.items.find(
        (i: { variantId: string }) => i.variantId === testVariant2.id
      );
      expect(mergedItem).toBeDefined();
      expect(mergedItem.quantity).toBe(3); // Aggregated 2 + 1 = 3
    });

    it("should reject merge attempt without authentication (401 Unauthorized)", async () => {
      cookieJar.clear();
      const req = new NextRequest("http://localhost:3000/api/v1/cart/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guestCartToken: "dummy_token" }),
      });

      const res = await mergeCartRoute(req);
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.error.code).toBe("UNAUTHORIZED");
    });
  });
});
