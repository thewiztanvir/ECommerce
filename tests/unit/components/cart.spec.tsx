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
  usePathname: () => "/cart",
  useSearchParams: () => new URLSearchParams(),
}));

import { CartProvider, CartItem, AppliedCoupon } from "@/context/cart-context";
import { CartDrawer } from "@/components/storefront/cart-drawer";
import FullCartPage from "@/app/(storefront)/cart/page";
import { Header } from "@/components/storefront/header";

const mockItem1: CartItem = {
  id: "item_01",
  variantId: "var_01",
  productId: "prod_01",
  productSlug: "quantum-wireless-headphones",
  title: "Quantum Wireless ANC Headphones",
  variantTitle: "Matte Black",
  attributes: { Color: "Matte Black" },
  unitPriceMinor: 19999, // $199.99
  compareAtPriceMinor: 24999, // $249.99
  quantity: 1,
  thumbnailUrl: "https://images.unsplash.com/photo-headphones.jpg",
  maxAvailableStock: 5,
};

const mockItem2: CartItem = {
  id: "item_02",
  variantId: "var_02",
  productId: "prod_02",
  productSlug: "merino-wool-crewneck",
  title: "Merino Wool Thermal Crewneck",
  variantTitle: "Heather Gray / M",
  attributes: { Color: "Heather Gray", Size: "M" },
  unitPriceMinor: 8900, // $89.00
  compareAtPriceMinor: null,
  quantity: 2,
  thumbnailUrl: null,
  maxAvailableStock: 10,
};

const mockLowPriceItem: CartItem = {
  id: "item_03",
  variantId: "var_03",
  productId: "prod_03",
  productSlug: "organic-cotton-tote",
  title: "Organic Cotton Canvas Tote",
  variantTitle: "Natural",
  attributes: { Color: "Natural" },
  unitPriceMinor: 2500, // $25.00 (under $75 free shipping threshold)
  compareAtPriceMinor: null,
  quantity: 1,
  thumbnailUrl: null,
  maxAvailableStock: 20,
};

const mockCouponSummer20: AppliedCoupon = {
  code: "SUMMER20",
  discountType: "PERCENTAGE",
  discountValue: 20,
  description: "20% off your entire order",
};

const mockCouponFixedApex10: AppliedCoupon = {
  code: "APEX10",
  discountType: "FIXED",
  discountValue: 1000, // $10.00
  description: "$10 off orders over $50",
};

describe("Shopping Cart UI & Checkout Entryway Unit Tests", () => {
  describe("1. CartDrawer Component", () => {
    it("should return null when drawer is closed (isOpen=false)", () => {
      const html = renderToStaticMarkup(
        <CartProvider initialIsOpen={false}>
          <CartDrawer />
        </CartProvider>
      );
      expect(html).toBe("");
    });

    it("should render accessible dialog container with role='dialog' and aria-modal='true' when open", () => {
      const html = renderToStaticMarkup(
        <CartProvider initialIsOpen={true}>
          <CartDrawer />
        </CartProvider>
      );
      expect(html).toContain('role="dialog"');
      expect(html).toContain('aria-modal="true"');
      expect(html).toContain('aria-label="Shopping Cart Drawer"');
      expect(html).toContain('aria-label="Close shopping cart"');
      expect(html).toContain("min-h-touch");
      expect(html).toContain("min-w-touch");
    });

    it("should render friendly empty state when cart has no items", () => {
      const html = renderToStaticMarkup(
        <CartProvider initialIsOpen={true} initialItems={[]}>
          <CartDrawer />
        </CartProvider>
      );
      expect(html).toContain("Your cart is empty");
      expect(html).toContain("Start Shopping");
      expect(html).toContain('href="/#categories"');
    });

    it("should render line items with thumbnails, variant attributes, formatted prices, and quantity controls", () => {
      const html = renderToStaticMarkup(
        <CartProvider initialIsOpen={true} initialItems={[mockItem1, mockItem2]}>
          <CartDrawer />
        </CartProvider>
      );

      // Titles and links
      expect(html).toContain("Quantum Wireless ANC Headphones");
      expect(html).toContain('href="/product/quantum-wireless-headphones"');
      expect(html).toContain("Merino Wool Thermal Crewneck");
      expect(html).toContain('href="/product/merino-wool-crewneck"');

      // Variant attributes
      expect(html).toContain("Color: Matte Black");
      expect(html).toContain("Color: Heather Gray");
      expect(html).toContain("Size: M");

      // Formatted minor-unit prices
      expect(html).toContain("$199.99"); // Item 1 total (1 * $199.99)
      expect(html).toContain("$178.00"); // Item 2 total (2 * $89.00)

      // Steppers & controls
      expect(html).toContain('aria-label="Decrease quantity of Quantum Wireless ANC Headphones"');
      expect(html).toContain('aria-label="Increase quantity of Quantum Wireless ANC Headphones"');
      expect(html).toContain('aria-label="Remove Quantum Wireless ANC Headphones from cart"');
    });

    it("should render real-time order summary with subtotal, free shipping, and proceed CTA", () => {
      // Subtotal = 19999 + (8900 * 2) = 19999 + 17800 = 37799 ($377.99 > $75 => Free Shipping)
      const html = renderToStaticMarkup(
        <CartProvider initialIsOpen={true} initialItems={[mockItem1, mockItem2]}>
          <CartDrawer />
        </CartProvider>
      );

      expect(html).toContain("Subtotal");
      expect(html).toContain("$377.99");
      expect(html).toContain("FREE");
      expect(html).toContain("FREE Express Shipping");
      expect(html).toContain("Estimated Total");
      expect(html).toContain("$377.99");
      expect(html).toContain("Proceed to Checkout");
      expect(html).toContain('href="/checkout"');
      expect(html).toContain('href="/cart"');
      expect(html).toContain("View Full Cart");
    });

    it("should display standard shipping and remaining amount when subtotal is below $75 threshold", () => {
      // Subtotal = $25.00 (< $75.00 => Standard Shipping $9.99)
      const html = renderToStaticMarkup(
        <CartProvider initialIsOpen={true} initialItems={[mockLowPriceItem]}>
          <CartDrawer />
        </CartProvider>
      );

      expect(html).toContain("$25.00"); // Subtotal
      expect(html).toContain("$9.99"); // Shipping
      expect(html).toContain("$50.00"); // $75 - $25 = $50 remaining
      expect(html).toContain("more for FREE Shipping");
      expect(html).toContain("$34.99"); // Total: $25.00 + $9.99
    });

    it("should display applied coupon and discount deduction when promotional code is active", () => {
      // Subtotal = $199.99, Coupon = SUMMER20 (20% off = $40.00 discount)
      const html = renderToStaticMarkup(
        <CartProvider
          initialIsOpen={true}
          initialItems={[mockItem1]}
          initialCoupon={mockCouponSummer20}
        >
          <CartDrawer />
        </CartProvider>
      );

      expect(html).toContain("SUMMER20");
      expect(html).toContain("-$40.00");
      expect(html).toContain("Remove");
      // Total: 199.99 - 40.00 = 159.99 (Free shipping)
      expect(html).toContain("$159.99");
    });
  });

  describe("2. FullCartPage Component", () => {
    it("should render breadcrumbs and empty state when cart has no items", () => {
      const html = renderToStaticMarkup(
        <CartProvider initialItems={[]}>
          <FullCartPage />
        </CartProvider>
      );

      expect(html).toContain('aria-label="Breadcrumb"');
      expect(html).toContain("Shopping Cart");
      expect(html).toContain("Your cart is currently empty");
      expect(html).toContain("Start Shopping");
      expect(html).toContain('href="/#categories"');
    });

    it("should render two-column responsive layout with line items and sticky summary card when populated", () => {
      const html = renderToStaticMarkup(
        <CartProvider initialItems={[mockItem1, mockItem2]}>
          <FullCartPage />
        </CartProvider>
      );

      // Two-column layout grid classes
      expect(html).toContain("grid grid-cols-1 lg:grid-cols-12");
      expect(html).toContain("lg:col-span-8");
      expect(html).toContain("lg:col-span-4 sticky top-24");

      // Line items
      expect(html).toContain("Quantum Wireless ANC Headphones");
      expect(html).toContain("Merino Wool Thermal Crewneck");
      expect(html).toContain("$199.99 unit price");
      expect(html).toContain("$89.00 unit price");

      // Order Summary
      expect(html).toContain("Order Summary");
      expect(html).toContain("Promotional Coupon");
      expect(html).toContain('placeholder="Promo code (e.g. SUMMER20)"');
      expect(html).toContain("Subtotal");
      expect(html).toContain("$377.99");
      expect(html).toContain("Proceed to Checkout");
      expect(html).toContain('href="/checkout"');

      // Clear cart button
      expect(html).toContain("Clear entire cart");
      expect(html).toContain("Continue Shopping");
    });

    it("should display fixed-amount coupon discount accurately on full cart page", () => {
      // Subtotal = $199.99, Fixed discount = $10.00 (APEX10)
      const html = renderToStaticMarkup(
        <CartProvider
          initialItems={[mockItem1]}
          initialCoupon={mockCouponFixedApex10}
        >
          <FullCartPage />
        </CartProvider>
      );

      expect(html).toContain("APEX10");
      expect(html).toContain("-$10.00");
      // Total: 199.99 - 10.00 = 189.99
      expect(html).toContain("$189.99");
    });
  });

  describe("3. Header Cart Integration", () => {
    it("should synchronize header cart counter badge with CartProvider total item count", () => {
      // 1 item of mockItem1 + 2 items of mockItem2 = 3 items
      const html = renderToStaticMarkup(
        <CartProvider initialItems={[mockItem1, mockItem2]}>
          <Header />
        </CartProvider>
      );

      expect(html).toContain('aria-label="Shopping cart with 3 items"');
      expect(html).toContain('aria-live="polite"');
      expect(html).toContain(">3<");
    });

    it("should display 0 items badge when cart is empty", () => {
      const html = renderToStaticMarkup(
        <CartProvider initialItems={[]}>
          <Header />
        </CartProvider>
      );

      expect(html).toContain('aria-label="Shopping cart with 0 items"');
      expect(html).toContain(">0<");
    });
  });
});
