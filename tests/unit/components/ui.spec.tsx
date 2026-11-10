import { describe, it, expect } from "vitest";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";

describe("UI Primitives Unit Tests", () => {
  describe("1. Button Component", () => {
    it("should render a default button with type='button' and accessible attributes", () => {
      const html = renderToStaticMarkup(
        <Button>Click Me</Button>
      );
      expect(html).toContain('type="button"');
      expect(html).toContain("Click Me");
      expect(html).toContain("bg-brand-600");
      // Touch target on mobile
      expect(html).toContain("min-h-touch");
      expect(html).toContain("min-w-touch");
      // WCAG 2.2 AA visible focus ring
      expect(html).toContain("focus-visible:ring-2");
      expect(html).toContain("focus-visible:ring-offset-2");
    });

    it("should render secondary, outline, ghost, danger, success, and link variants", () => {
      const secondary = renderToStaticMarkup(
        <Button variant="secondary">Secondary</Button>
      );
      expect(secondary).toContain("bg-slate-100");

      const outline = renderToStaticMarkup(
        <Button variant="outline">Outline</Button>
      );
      expect(outline).toContain("border-2 border-slate-300");

      const ghost = renderToStaticMarkup(
        <Button variant="ghost">Ghost</Button>
      );
      expect(ghost).toContain("hover:bg-slate-100");

      const danger = renderToStaticMarkup(
        <Button variant="danger">Delete</Button>
      );
      expect(danger).toContain("bg-rose-600");

      const success = renderToStaticMarkup(
        <Button variant="success">Confirm</Button>
      );
      expect(success).toContain("bg-emerald-600");

      const link = renderToStaticMarkup(
        <Button variant="link">View Details</Button>
      );
      expect(link).toContain("text-brand-600");
      expect(link).toContain("hover:underline");
    });

    it("should support responsive sizes and 44x44px touch targets on mobile", () => {
      const sm = renderToStaticMarkup(<Button size="sm">Small</Button>);
      expect(sm).toContain("min-h-touch");
      expect(sm).toContain("min-w-touch");
      expect(sm).toContain("sm:min-h-[36px]");

      const md = renderToStaticMarkup(<Button size="md">Medium</Button>);
      expect(md).toContain("h-11");
      expect(md).toContain("min-h-touch");

      const lg = renderToStaticMarkup(<Button size="lg">Large</Button>);
      expect(lg).toContain("min-h-[48px]");

      const icon = renderToStaticMarkup(<Button size="icon" aria-label="Search" />);
      expect(icon).toContain("w-11");
      expect(icon).toContain("min-h-touch");
    });

    it("should handle disabled state with disabled and aria-disabled attributes", () => {
      const html = renderToStaticMarkup(
        <Button disabled>Disabled Button</Button>
      );
      expect(html).toContain("disabled");
      expect(html).toContain('aria-disabled="true"');
      expect(html).toContain("disabled:opacity-50");
    });

    it("should handle loading state with aria-busy, spinner, and loading text", () => {
      const html = renderToStaticMarkup(
        <Button isLoading loadingText="Processing...">Submit Order</Button>
      );
      expect(html).toContain('aria-busy="true"');
      expect(html).toContain('aria-disabled="true"');
      expect(html).toContain("disabled");
      expect(html).toContain("animate-spin");
      expect(html).toContain('aria-hidden="true"');
      expect(html).toContain("Processing...");
      expect(html).not.toContain("Submit Order");
    });

    it("should handle loading state without loadingText using screen reader announcement", () => {
      const html = renderToStaticMarkup(
        <Button isLoading>Save Changes</Button>
      );
      expect(html).toContain('aria-busy="true"');
      expect(html).toContain('class="sr-only">Loading...</span>');
      expect(html).toContain("Save Changes");
    });

    it("should render left and right icons with aria-hidden", () => {
      const html = renderToStaticMarkup(
        <Button
          leftIcon={<span data-testid="left-icon">←</span>}
          rightIcon={<span data-testid="right-icon">→</span>}
        >
          Navigate
        </Button>
      );
      expect(html).toContain('data-testid="left-icon"');
      expect(html).toContain('data-testid="right-icon"');
    });

    it("should support fullWidth prop", () => {
      const html = renderToStaticMarkup(
        <Button fullWidth>Checkout</Button>
      );
      expect(html).toContain("w-full");
    });
  });

  describe("2. Input Component", () => {
    it("should render an accessible input with label and htmlFor connection", () => {
      const html = renderToStaticMarkup(
        <Input id="email-field" label="Email Address" type="email" placeholder="you@example.com" />
      );
      expect(html).toContain('for="email-field"');
      expect(html).toContain('id="email-field"');
      expect(html).toContain('type="email"');
      expect(html).toContain('Email Address');
      expect(html).toContain('placeholder="you@example.com"');
      // Touch target min-height
      expect(html).toContain("min-h-touch");
      // Focus ring
      expect(html).toContain("focus-visible:ring-2");
      expect(html).toContain("focus-visible:ring-brand-600");
    });

    it("should display required indicator and set aria-required when required", () => {
      const html = renderToStaticMarkup(
        <Input label="Password" required />
      );
      expect(html).toContain('aria-required="true"');
      expect(html).toContain("required");
      expect(html).toContain("*");
    });

    it("should link hint text via aria-describedby", () => {
      const html = renderToStaticMarkup(
        <Input id="promo" label="Promo Code" hint="Enter coupon code from newsletter" />
      );
      expect(html).toContain('aria-describedby="promo-hint"');
      expect(html).toContain('id="promo-hint"');
      expect(html).toContain("Enter coupon code from newsletter");
    });

    it("should handle error state with aria-invalid, role='alert', and aria-describedby", () => {
      const html = renderToStaticMarkup(
        <Input
          id="card-number"
          label="Card Number"
          error="Card number must be 16 digits"
        />
      );
      expect(html).toContain('aria-invalid="true"');
      expect(html).toContain('aria-describedby="card-number-error"');
      expect(html).toContain('id="card-number-error"');
      expect(html).toContain('role="alert"');
      expect(html).toContain("Card number must be 16 digits");
      expect(html).toContain("border-rose-500");
    });

    it("should combine hint and error in aria-describedby when both exist", () => {
      const html = renderToStaticMarkup(
        <Input
          id="username"
          label="Username"
          hint="Must be alphanumeric"
          error="Username already taken"
        />
      );
      expect(html).toContain('aria-describedby="username-error username-hint"');
      expect(html).toContain('id="username-error"');
      expect(html).toContain('id="username-hint"');
    });

    it("should handle success state with success styling and check icon", () => {
      const html = renderToStaticMarkup(
        <Input
          id="discount"
          label="Coupon"
          success="Coupon SUMMER20 applied (-20%)"
        />
      );
      expect(html).toContain("border-emerald-500");
      expect(html).toContain('id="discount-success"');
      expect(html).toContain("Coupon SUMMER20 applied (-20%)");
    });

    it("should render left and right icons with correct padding classes", () => {
      const html = renderToStaticMarkup(
        <Input
          label="Search"
          leftIcon={<span data-testid="search-icon">🔍</span>}
          rightIcon={<span data-testid="clear-icon">✖</span>}
        />
      );
      expect(html).toContain("pl-10");
      expect(html).toContain("pr-10");
      expect(html).toContain('data-testid="search-icon"');
      expect(html).toContain('data-testid="clear-icon"');
    });

    it("should support disabled and readOnly states", () => {
      const disabledHtml = renderToStaticMarkup(
        <Input label="Locked" disabled />
      );
      expect(disabledHtml).toContain("disabled");
      expect(disabledHtml).toContain("disabled:cursor-not-allowed");

      const readOnlyHtml = renderToStaticMarkup(
        <Input label="Fixed ID" readOnly value="ORD-12345" />
      );
      expect(readOnlyHtml.toLowerCase()).toContain("readonly");
      expect(readOnlyHtml).toContain("read-only:cursor-default");
    });
  });

  describe("3. Badge Component", () => {
    it("should render status badge with role='status'", () => {
      const html = renderToStaticMarkup(
        <Badge>Neutral Status</Badge>
      );
      expect(html).toContain('role="status"');
      expect(html).toContain("Neutral Status");
      expect(html).toContain("bg-slate-100");
      expect(html).toContain("text-slate-700");
    });

    it("should render all status variants (success, warning, error, info, brand)", () => {
      const success = renderToStaticMarkup(
        <Badge variant="success">In Stock</Badge>
      );
      expect(success).toContain("bg-emerald-50");
      expect(success).toContain("text-emerald-800");

      const warning = renderToStaticMarkup(
        <Badge variant="warning">Low Stock</Badge>
      );
      expect(warning).toContain("bg-amber-50");
      expect(warning).toContain("text-amber-800");

      const error = renderToStaticMarkup(
        <Badge variant="error">Out of Stock</Badge>
      );
      expect(error).toContain("bg-rose-50");
      expect(error).toContain("text-rose-800");

      const info = renderToStaticMarkup(
        <Badge variant="info">New Arrival</Badge>
      );
      expect(info).toContain("bg-blue-50");
      expect(info).toContain("text-blue-800");

      const brand = renderToStaticMarkup(
        <Badge variant="brand">Featured</Badge>
      );
      expect(brand).toContain("bg-brand-50");
      expect(brand).toContain("text-brand-700");
    });

    it("should support status dot indicator", () => {
      const html = renderToStaticMarkup(
        <Badge variant="success" dot>Live</Badge>
      );
      expect(html).toContain("h-1.5 w-1.5 rounded-full");
      expect(html).toContain("bg-emerald-600");
      expect(html).toContain('aria-hidden="true"');
    });

    it("should support sizes (sm, md, lg)", () => {
      const sm = renderToStaticMarkup(<Badge size="sm">Small</Badge>);
      expect(sm).toContain("text-[11px]");

      const md = renderToStaticMarkup(<Badge size="md">Medium</Badge>);
      expect(md).toContain("text-xs");

      const lg = renderToStaticMarkup(<Badge size="lg">Large</Badge>);
      expect(lg).toContain("text-sm");
    });
  });

  describe("4. Card Component", () => {
    it("should render responsive container Card with subcomponents", () => {
      const html = renderToStaticMarkup(
        <Card>
          <CardHeader>
            <CardTitle>Wireless Headphones</CardTitle>
            <CardDescription>Noise cancelling over-ear</CardDescription>
          </CardHeader>
          <CardContent>
            <p>High fidelity audio reproduction.</p>
          </CardContent>
          <CardFooter>
            <Button>Add to Cart</Button>
          </CardFooter>
        </Card>
      );
      expect(html).toContain("rounded-xl");
      expect(html).toContain("bg-white");
      expect(html).toContain("border-slate-200");
      expect(html).toContain("<h3");
      expect(html).toContain("Wireless Headphones");
      expect(html).toContain("Noise cancelling over-ear");
      expect(html).toContain("High fidelity audio reproduction.");
      expect(html).toContain("Add to Cart");
    });

    it("should support custom semantic heading levels in CardTitle", () => {
      const h2Html = renderToStaticMarkup(
        <CardTitle as="h2">Section Header</CardTitle>
      );
      expect(h2Html).toContain("<h2");
      expect(h2Html).toContain("Section Header");

      const h4Html = renderToStaticMarkup(
        <CardTitle as="h4">Sub Section</CardTitle>
      );
      expect(h4Html).toContain("<h4");
      expect(h4Html).toContain("Sub Section");
    });

    it("should support card variants including interactive with focus indicator", () => {
      const interactive = renderToStaticMarkup(
        <Card variant="interactive">
          <CardContent>Product Tile</CardContent>
        </Card>
      );
      expect(interactive).toContain('tabindex="0"');
      expect(interactive).toContain("cursor-pointer");
      expect(interactive).toContain("focus-visible:ring-2");
      expect(interactive).toContain("focus-visible:ring-brand-600");

      const elevated = renderToStaticMarkup(
        <Card variant="elevated">
          <CardContent>Elevated Card</CardContent>
        </Card>
      );
      expect(elevated).toContain("shadow-md");

      const subtle = renderToStaticMarkup(
        <Card variant="subtle">
          <CardContent>Subtle Card</CardContent>
        </Card>
      );
      expect(subtle).toContain("bg-slate-50");
    });
  });
});
