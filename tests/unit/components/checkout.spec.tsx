import { describe, it, expect, vi } from "vitest";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/checkout",
  useSearchParams: () => new URLSearchParams(),
}));

import { CartProvider, CartItem, AppliedCoupon } from "@/context/cart-context";
import CheckoutPage from "@/app/(storefront)/checkout/page";
import OrderConfirmationPage from "@/app/(storefront)/checkout/confirmation/[reference]/page";
import {
  placeOrderSchema,
  SHIPPING_RATES,
} from "@/lib/validations/checkout.schema";
import { generateOrderReference } from "@/lib/identifiers";

const mockItem1: CartItem = {
  id: "item_chk_01",
  variantId: "var_chk_01",
  productId: "prod_chk_01",
  productSlug: "quantum-wireless-headphones",
  title: "Quantum Wireless ANC Headphones",
  variantTitle: "Matte Black",
  attributes: { Color: "Matte Black" },
  unitPriceMinor: 19999, // $199.99
  compareAtPriceMinor: null,
  quantity: 1,
  thumbnailUrl: "https://images.unsplash.com/photo-headphones.jpg",
  maxAvailableStock: 5,
};

const mockCouponSummer20: AppliedCoupon = {
  code: "SUMMER20",
  discountType: "PERCENTAGE",
  discountValue: 20,
  description: "20% off your entire order",
};

describe("Checkout Experience & Order Confirmation Unit Tests", () => {
  describe("1. CheckoutPage Component", () => {
    it("should render empty state when cart has no items", () => {
      const html = renderToStaticMarkup(
        <CartProvider initialItems={[]}>
          <CheckoutPage />
        </CartProvider>
      );

      expect(html).toContain("Your Cart is Empty");
      expect(html).toContain("Browse Catalog");
      expect(html).toContain('href="/#categories"');
    });

    it("should render breadcrumbs, wizard progress indicator, and Step 1 form when items are in cart", () => {
      const html = renderToStaticMarkup(
        <CartProvider initialItems={[mockItem1]}>
          <CheckoutPage />
        </CartProvider>
      );

      // Breadcrumbs
      expect(html).toContain('aria-label="Breadcrumb"');
      expect(html).toContain("Checkout");

      // Progress Tracker
      expect(html).toContain("Shipping &amp; Contact");
      expect(html).toContain("Delivery Method");
      expect(html).toContain("Payment");

      // Step 1 Form Fields
      expect(html).toContain("First Name *");
      expect(html).toContain("Last Name *");
      expect(html).toContain("Email Address *");
      expect(html).toContain("Street Address *");
      expect(html).toContain("City *");
      expect(html).toContain("State / Province *");
      expect(html).toContain("Postal / ZIP Code *");
      expect(html).toContain("Continue to Delivery Method");
    });

    it("should render sticky Order Summary sidebar with line items and financial breakdown", () => {
      // Subtotal = $199.99 (> $75 threshold -> Free standard shipping)
      const html = renderToStaticMarkup(
        <CartProvider initialItems={[mockItem1]}>
          <CheckoutPage />
        </CartProvider>
      );

      expect(html).toContain("Order Summary");
      expect(html).toContain("Quantum Wireless ANC Headphones");
      expect(html).toContain("Qty: 1");
      expect(html).toContain("$199.99"); // Subtotal
      expect(html).toContain("FREE"); // Standard shipping free over $75
      expect(html).toContain("Estimated Sales Tax (8.5%)");
      expect(html).toContain("Grand Total");
      expect(html).toContain("Risk-Free 30-Day Guarantee");
    });

    it("should display promotional coupon discount deduction in checkout summary", () => {
      // Subtotal = $199.99, Discount = 20% = $40.00
      const html = renderToStaticMarkup(
        <CartProvider initialItems={[mockItem1]} initialCoupon={mockCouponSummer20}>
          <CheckoutPage />
        </CartProvider>
      );

      expect(html).toContain("Discount (SUMMER20)");
      expect(html).toContain("-$40.00");
    });

    it("should enforce WCAG 2.2 AA touch targets of at least 44x44px on interactive controls", () => {
      const html = renderToStaticMarkup(
        <CartProvider initialItems={[mockItem1]}>
          <CheckoutPage />
        </CartProvider>
      );

      expect(html).toContain("min-h-touch");
    });
  });

  describe("2. OrderConfirmationPage Component", () => {
    it("should render order success hero with checkmark and reference number", async () => {
      const jsx = await OrderConfirmationPage({
        params: Promise.resolve({ reference: "ORD-2026-X8K9M2P4" }),
      });
      const html = renderToStaticMarkup(jsx);

      expect(html).toContain("Thank you for your order!");
      expect(html).toContain("Order Confirmed &amp; Paid");
      expect(html).toContain("ORD-2026-X8K9M2P4");
    });

    it("should render 5-step fulfillment timeline (Placed -> Paid -> Processing -> Shipped -> Delivered)", async () => {
      const jsx = await OrderConfirmationPage({
        params: Promise.resolve({ reference: "ORD-2026-TEST9999" }),
      });
      const html = renderToStaticMarkup(jsx);

      expect(html).toContain("Fulfillment Status &amp; Timeline");
      expect(html).toContain("Placed");
      expect(html).toContain("Paid");
      expect(html).toContain("Processing");
      expect(html).toContain("Shipped");
      expect(html).toContain("Delivered");
    });

    it("should render shipping destination, payment receipt summary, and continue shopping action", async () => {
      const jsx = await OrderConfirmationPage({
        params: Promise.resolve({ reference: "ORD-2026-TEST8888" }),
      });
      const html = renderToStaticMarkup(jsx);

      expect(html).toContain("Shipping Destination");
      expect(html).toContain("Payment Receipt");
      expect(html).toContain("Continue Shopping");
      expect(html).toContain('href="/"');
      expect(html).toContain("Credit Card ending in");
      expect(html).toContain("4242");
    });
  });

  describe("3. Checkout Schema Validation & Idempotency", () => {
    it("should validate a valid place order payload", () => {
      const validPayload = {
        customer: {
          email: "customer@example.com",
          firstName: "John",
          lastName: "Doe",
          phone: "+15551234567",
        },
        shippingAddress: {
          recipientName: "John Doe",
          streetLine1: "123 Main St",
          streetLine2: "Apt 4B",
          city: "San Francisco",
          state: "CA",
          postalCode: "94105",
          countryCode: "US",
        },
        shippingMethod: "STANDARD" as const,
        payment: {
          cardNumber: "4242424242424242",
          cardholderName: "John Doe",
          expiry: "12/28",
          cvc: "123",
        },
        items: [
          {
            variantId: "var_01",
            quantity: 2,
            title: "Test Item",
            unitPriceMinor: 5000,
          },
        ],
        couponCode: "SUMMER20",
        idempotencyKey: "chk_idemp_key_12345",
      };

      const result = placeOrderSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it("should reject order placement when required contact or card fields are missing", () => {
      const invalidPayload = {
        customer: {
          email: "invalid-email",
          firstName: "",
          lastName: "",
        },
        shippingAddress: {
          recipientName: "",
          streetLine1: "",
          city: "",
          state: "",
          postalCode: "",
        },
        shippingMethod: "STANDARD",
        payment: {
          cardNumber: "123", // too short
          cardholderName: "",
          expiry: "bad",
          cvc: "0",
        },
        items: [], // empty items
      };

      const result = placeOrderSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThanOrEqual(5);
      }
    });

    it("should generate unambiguous public order references matching ORD-YYYY-XXXXXXXX pattern", () => {
      const ref = generateOrderReference();
      expect(ref).toMatch(/^ORD-\d{4}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/);
    });
  });
});
