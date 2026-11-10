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
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

import { Header } from "@/components/storefront/header";
import { MobileNav } from "@/components/storefront/mobile-nav";
import { Footer } from "@/components/storefront/footer";
import StorefrontHomePage from "@/app/(storefront)/page";

describe("Storefront Shell & Responsive Navigation Unit Tests", () => {
  describe("1. Header Component", () => {
    it("should render brand logo linking to root", () => {
      const html = renderToStaticMarkup(<Header />);
      expect(html).toContain('href="/"');
      expect(html).toContain("ApexStore");
    });

    it("should display main navigation categories (Electronics, Apparel, Home & Living)", () => {
      const html = renderToStaticMarkup(<Header />);
      expect(html).toContain("Electronics");
      expect(html).toContain("Apparel");
      expect(html).toContain("Home &amp; Living");
      expect(html).toContain('href="/category/electronics"');
      expect(html).toContain('href="/category/apparel"');
      expect(html).toContain('href="/category/home-living"');
    });

    it("should display search bars with submit buttons and accessible labels", () => {
      const html = renderToStaticMarkup(<Header initialSearchQuery="headphones" />);
      expect(html).toContain('role="search"');
      expect(html).toContain('value="headphones"');
      expect(html).toContain('placeholder="Search catalog, brands, items..."');
      expect(html).toContain("Search products");
    });

    it("should display login and register links when guest user is browsing", () => {
      const html = renderToStaticMarkup(<Header user={null} />);
      expect(html).toContain('href="/login"');
      expect(html).toContain("Sign In");
      expect(html).toContain('href="/register"');
      expect(html).toContain("Register");
    });

    it("should display user account dropdown trigger when user is logged in", () => {
      const mockUser = {
        id: "usr_123",
        firstName: "Eleanor",
        email: "eleanor@example.com",
        role: "CUSTOMER",
      };
      const html = renderToStaticMarkup(<Header user={mockUser} />);
      expect(html).toContain("Eleanor");
      expect(html).toContain("Hello,");
      expect(html).toContain('id="user-menu-button"');
    });

    it("should display cart button with live count badge and aria-live='polite'", () => {
      const html = renderToStaticMarkup(<Header cartItemCount={3} />);
      expect(html).toContain('href="/cart"');
      expect(html).toContain('aria-live="polite"');
      expect(html).toContain(">3<");
      expect(html).toContain('aria-label="Shopping cart with 3 items"');
    });

    it("should provide accessible mobile menu hamburger button with 44x44px touch target", () => {
      const html = renderToStaticMarkup(<Header />);
      expect(html).toContain('aria-label="Open navigation menu"');
      expect(html).toContain("min-h-touch");
      expect(html).toContain("min-w-touch");
    });
  });

  describe("2. MobileNav Drawer Component", () => {
    it("should return null when closed (isOpen=false)", () => {
      const html = renderToStaticMarkup(
        <MobileNav isOpen={false} onClose={() => {}} />
      );
      expect(html).toBe("");
    });

    it("should render accessible dialog drawer when open (isOpen=true)", () => {
      const html = renderToStaticMarkup(
        <MobileNav isOpen={true} onClose={() => {}} cartItemCount={2} />
      );
      expect(html).toContain('role="dialog"');
      expect(html).toContain('aria-modal="true"');
      expect(html).toContain('aria-label="Mobile navigation menu"');
      expect(html).toContain('aria-label="Close navigation menu"');
      expect(html).toContain("min-h-touch");
      expect(html).toContain("min-w-touch");
      expect(html).toContain("Electronics");
      expect(html).toContain("Apparel");
      expect(html).toContain("Home &amp; Living");
      expect(html).toContain(">2<");
    });

    it("should display user profile info inside mobile drawer when logged in", () => {
      const mockUser = { firstName: "Marcus", email: "marcus@example.com" };
      const html = renderToStaticMarkup(
        <MobileNav isOpen={true} onClose={() => {}} user={mockUser} />
      );
      expect(html).toContain("Marcus");
      expect(html).toContain("marcus@example.com");
      expect(html).toContain("My Account");
    });
  });

  describe("3. Footer Component", () => {
    it("should render reassurance value bar (Shipping, Returns, Security, Authenticity)", () => {
      const html = renderToStaticMarkup(<Footer />);
      expect(html).toContain("Free Express Shipping");
      expect(html).toContain("30-Day Hassle-Free Returns");
      expect(html).toContain("PCI-DSS Level 1 Secure");
      expect(html).toContain("Authenticity Guaranteed");
    });

    it("should render multi-column navigation links (Customer Service, About, Policies)", () => {
      const html = renderToStaticMarkup(<Footer />);
      expect(html).toContain("Customer Service");
      expect(html).toContain("Help Center &amp; FAQs");
      expect(html).toContain("Track Your Order");
      expect(html).toContain("About ApexStore");
      expect(html).toContain("Policies &amp; Legal");
      expect(html).toContain('href="/privacy"');
      expect(html).toContain('href="/terms"');
      expect(html).toContain('href="/return-policy"');
    });

    it("should render accessible newsletter subscription input and copyright notice", () => {
      const html = renderToStaticMarkup(<Footer />);
      expect(html).toContain('id="newsletter-email"');
      expect(html).toContain('type="email"');
      expect(html).toContain("Subscribe to our newsletter");
      expect(html).toContain("ApexStore Inc. All rights reserved.");
      expect(html).toContain("WCAG 2.2 AA accessibility standards");
    });
  });

  describe("4. Storefront Home Page", () => {
    it("should render hero section with call-to-actions and trust metrics", () => {
      const html = renderToStaticMarkup(<StorefrontHomePage />);
      expect(html).toContain('id="hero-heading"');
      expect(html).toContain("Engineered for life.");
      expect(html).toContain("Explore Catalog");
      expect(html).toContain("Browse Departments");
      expect(html).toContain("40k+");
      expect(html).toContain("Delighted Shoppers");
    });

    it("should render category quick-browse grid with interactive cards", () => {
      const html = renderToStaticMarkup(<StorefrontHomePage />);
      expect(html).toContain('id="category-heading"');
      expect(html).toContain("Shop by Category");
      expect(html).toContain("Electronics");
      expect(html).toContain("Apparel");
      expect(html).toContain("Home &amp; Living");
      expect(html).toContain("Accessories");
    });

    it("should render featured products with ratings, pricing, and Add to Cart triggers", () => {
      const html = renderToStaticMarkup(<StorefrontHomePage />);
      expect(html).toContain('id="featured-heading"');
      expect(html).toContain("Featured Products");
      expect(html).toContain("Apex Pro Wireless ANC");
      expect(html).toContain("Merino Wool Thermal Overshirt");
      expect(html).toContain("Solid Walnut Ergonomic Desk Shelf");
      expect(html).toContain("$299.00");
      expect(html).toContain("$145.00");
      expect(html).toContain("Add to Cart");
    });

    it("should render the confidence & registration conversion banner", () => {
      const html = renderToStaticMarkup(<StorefrontHomePage />);
      expect(html).toContain('id="confidence-heading"');
      expect(html).toContain("Join over 40,000 discerning shoppers worldwide.");
      expect(html).toContain("Create an Account");
    });
  });
});
