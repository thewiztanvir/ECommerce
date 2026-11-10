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
  usePathname: () => "/category/electronics",
  useSearchParams: () => new URLSearchParams(),
}));

import { Breadcrumbs } from "@/components/storefront/breadcrumbs";
import { ProductCard } from "@/components/storefront/product-card";
import { FilterBar } from "@/components/storefront/filter-bar";
import { Pagination } from "@/components/storefront/pagination";
import { PDPInteractive } from "@/components/storefront/pdp-interactive";
import type {
  CatalogProductSummary,
  CatalogProductDetail,
} from "@/modules/catalog/catalog.service";

describe("Catalog & Discovery Components Unit Tests", () => {
  describe("1. Breadcrumbs Component", () => {
    it("should render accessible breadcrumbs navigation with aria-current='page'", () => {
      const items = [
        { name: "Home", href: "/" },
        { name: "Electronics", href: "/category/electronics" },
        { name: "Audio", href: "/category/audio" },
      ];
      const html = renderToStaticMarkup(<Breadcrumbs items={items} />);

      expect(html).toContain('aria-label="Breadcrumb"');
      expect(html).toContain('href="/"');
      expect(html).toContain("Home");
      expect(html).toContain('href="/category/electronics"');
      expect(html).toContain("Electronics");
      expect(html).toContain('aria-current="page"');
      expect(html).toContain("Audio");
    });

    it("should render nothing when items array is empty", () => {
      const html = renderToStaticMarkup(<Breadcrumbs items={[]} />);
      expect(html).toBe("");
    });
  });

  describe("2. ProductCard Component", () => {
    const mockProduct: CatalogProductSummary = {
      id: "prod_01",
      slug: "quantum-wireless-headphones",
      title: "Quantum Wireless ANC Headphones",
      description: "Lossless studio sound with 40mm drivers.",
      brandName: "AcoustiQ",
      category: {
        id: "cat_01",
        slug: "audio-headphones",
        name: "Audio & Headphones",
      },
      price: {
        currency: "USD",
        amountMinor: 19999,
        compareAtAmountMinor: 24999,
      },
      priceRange: {
        minAmountMinor: 19999,
        maxAmountMinor: 19999,
        currency: "USD",
      },
      priceMinor: 19999,
      compareAtMinor: 24999,
      formattedPrice: "$199.99",
      formattedCompareAtPrice: "$249.99",
      savingsBadge: "Save 20%",
      stockStatus: "IN_STOCK",
      stockBadgeText: "In Stock",
      availableStock: 50,
      thumbnailUrl: null,
      inStock: true,
      variantsCount: 2,
      createdAt: new Date().toISOString(),
    };

    it("should render product thumbnail, brand, title, formatted price, and savings badge", () => {
      const html = renderToStaticMarkup(<ProductCard product={mockProduct} />);

      expect(html).toContain("Quantum Wireless ANC Headphones");
      expect(html).toContain("AcoustiQ");
      expect(html).toContain("$199.99");
      expect(html).toContain("$249.99");
      expect(html).toContain("Save 20%");
      expect(html).toContain("In Stock");
      expect(html).toContain('href="/product/quantum-wireless-headphones"');
      // Zero-CLS aspect ratio container
      expect(html).toContain("aspect-square");
    });

    it("should render warning badge when stock is low", () => {
      const lowStockProduct: CatalogProductSummary = {
        ...mockProduct,
        stockStatus: "LOW_STOCK",
        stockBadgeText: "Only 3 left",
        availableStock: 3,
      };
      const html = renderToStaticMarkup(<ProductCard product={lowStockProduct} />);

      expect(html).toContain("Only 3 left");
      expect(html).toContain("bg-amber-50");
    });

    it("should render error badge when out of stock", () => {
      const outOfStockProduct: CatalogProductSummary = {
        ...mockProduct,
        stockStatus: "OUT_OF_STOCK",
        stockBadgeText: "Out of Stock",
        availableStock: 0,
        inStock: false,
      };
      const html = renderToStaticMarkup(<ProductCard product={outOfStockProduct} />);

      expect(html).toContain("Out of Stock");
      expect(html).toContain("bg-rose-50");
      expect(html).toContain("Currently unavailable");
    });
  });

  describe("3. FilterBar Component", () => {
    it("should render total product count, price range inputs, and sort dropdown", () => {
      const html = renderToStaticMarkup(
        <FilterBar totalProducts={24} currentSort="newest" minPrice="50" maxPrice="200" />
      );

      expect(html).toContain("Showing");
      expect(html).toContain("24");
      expect(html).toContain("products");
      expect(html).toContain('id="filter-min-price"');
      expect(html).toContain('value="50"');
      expect(html).toContain('id="filter-max-price"');
      expect(html).toContain('value="200"');
      expect(html).toContain('id="filter-sort-select"');
      expect(html).toContain("Newest Releases");
      expect(html).toContain("Price: Low to High");
      expect(html).toContain("Price: High to Low");
      expect(html).toContain("Reset");
    });

    it("should not show reset button when no filters are active", () => {
      const html = renderToStaticMarkup(
        <FilterBar totalProducts={10} currentSort="newest" minPrice="" maxPrice="" />
      );
      expect(html).not.toContain("Reset");
    });
  });

  describe("4. Pagination Component", () => {
    it("should render pagination links and mark current page with aria-current='page'", () => {
      const html = renderToStaticMarkup(
        <Pagination
          currentPage={2}
          totalPages={4}
          baseUrl="/category/electronics"
          searchParams={{ sort: "price-asc" }}
        />
      );

      expect(html).toContain('aria-label="Pagination Navigation"');
      expect(html).toContain('aria-current="page"');
      expect(html).toContain(">2<");
      expect(html).toContain('href="/category/electronics?sort=price-asc"');
      expect(html).toContain('href="/category/electronics?sort=price-asc&amp;page=3"');
      expect(html).toContain('aria-label="Go to previous page"');
      expect(html).toContain('aria-label="Go to next page"');
    });

    it("should render nothing when totalPages is 1 or less", () => {
      const html = renderToStaticMarkup(
        <Pagination currentPage={1} totalPages={1} baseUrl="/category/electronics" />
      );
      expect(html).toBe("");
    });

    it("should disable previous button on page 1", () => {
      const html = renderToStaticMarkup(
        <Pagination currentPage={1} totalPages={3} baseUrl="/category/electronics" />
      );
      expect(html).toContain('aria-disabled="true"');
    });
  });

  describe("5. PDPInteractive Component", () => {
    const mockDetail: CatalogProductDetail = {
      id: "prod_detail_01",
      slug: "quantum-wireless-headphones",
      title: "Quantum Wireless Noise-Cancelling Headphones",
      description: "High-fidelity active noise-cancelling headphones featuring 40mm dynamic drivers.",
      brandName: "AcoustiQ",
      status: "PUBLISHED",
      category: {
        id: "cat_01",
        slug: "audio-headphones",
        name: "Audio & Headphones",
      },
      media: [
        {
          id: "med_01",
          url: "https://example.com/black.jpg",
          altText: "Midnight Black View",
          sortOrder: 1,
          isThumbnail: true,
        },
        {
          id: "med_02",
          url: "https://example.com/silver.jpg",
          altText: "Lunar Silver View",
          sortOrder: 2,
          isThumbnail: false,
        },
      ],
      variants: [
        {
          id: "var_01",
          sku: "QW-NC-BLK",
          barcode: "123456789012",
          title: "Midnight Black",
          attributes: { color: "Midnight Black" },
          stockStatus: "IN_STOCK",
          stockBadgeText: "In Stock",
          savingsBadge: "Save 20%",
          availableStock: 50,
          formattedPrice: "$199.99",
          formattedCompareAtPrice: "$249.99",
          priceMinor: 19999,
          compareAtMinor: 24999,
          price: {
            currency: "USD",
            amountMinor: 19999,
            compareAtAmountMinor: 24999,
          },
          inventory: {
            isAvailable: true,
            availableQuantity: 50,
          },
        },
        {
          id: "var_02",
          sku: "QW-NC-SLV",
          barcode: "123456789013",
          title: "Lunar Silver",
          attributes: { color: "Lunar Silver" },
          stockStatus: "LOW_STOCK",
          stockBadgeText: "Only 2 left",
          savingsBadge: "Save 20%",
          availableStock: 2,
          formattedPrice: "$199.99",
          formattedCompareAtPrice: "$249.99",
          priceMinor: 19999,
          compareAtMinor: 24999,
          price: {
            currency: "USD",
            amountMinor: 19999,
            compareAtAmountMinor: 24999,
          },
          inventory: {
            isAvailable: true,
            availableQuantity: 2,
          },
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it("should render main gallery, title, brand, SKU, formatted price, and savings badge", () => {
      const html = renderToStaticMarkup(<PDPInteractive product={mockDetail} />);

      expect(html).toContain("Quantum Wireless Noise-Cancelling Headphones");
      expect(html).toContain("AcoustiQ");
      expect(html).toContain("QW-NC-BLK");
      expect(html).toContain("$199.99");
      expect(html).toContain("$249.99");
      expect(html).toContain("Save 20%");
      expect(html).toContain("In Stock");
    });

    it("should render thumbnail selector with accessible aria-label and aria-current", () => {
      const html = renderToStaticMarkup(<PDPInteractive product={mockDetail} />);

      expect(html).toContain('aria-label="Product thumbnails"');
      expect(html).toContain('aria-label="View product image 1 of 2"');
      expect(html).toContain('aria-label="View product image 2 of 2"');
    });

    it("should render dynamic variant selector buttons with role='radio'", () => {
      const html = renderToStaticMarkup(<PDPInteractive product={mockDetail} />);

      expect(html).toContain('role="radiogroup"');
      expect(html).toContain('role="radio"');
      expect(html).toContain("Midnight Black");
      expect(html).toContain("Lunar Silver");
    });

    it("should render quantity selector with decrement and increment buttons", () => {
      const html = renderToStaticMarkup(<PDPInteractive product={mockDetail} />);

      expect(html).toContain('aria-label="Decrease quantity"');
      expect(html).toContain('aria-label="Increase quantity"');
      expect(html).toContain('aria-label="Quantity"');
      expect(html).toContain("Add to Cart");
    });

    it("should render accessible tabs for Description, Specifications, and Shipping", () => {
      const html = renderToStaticMarkup(<PDPInteractive product={mockDetail} />);

      expect(html).toContain('role="tablist"');
      expect(html).toContain('id="tab-description"');
      expect(html).toContain('id="tab-specs"');
      expect(html).toContain('id="tab-shipping"');
      expect(html).toContain('id="panel-description"');
      expect(html).toContain("High-fidelity active noise-cancelling");
      expect(html).toContain("Express Delivery");
    });

    it("should disable Add to Cart button when selected variant is out of stock", () => {
      const outOfStockDetail: CatalogProductDetail = {
        ...mockDetail,
        variants: [
          {
            ...mockDetail.variants[0],
            stockStatus: "OUT_OF_STOCK",
            stockBadgeText: "Out of Stock",
            availableStock: 0,
            inventory: { isAvailable: false, availableQuantity: 0 },
          },
        ],
      };
      const html = renderToStaticMarkup(<PDPInteractive product={outOfStockDetail} />);

      expect(html).toContain("Out of Stock");
      expect(html).toContain("disabled");
    });
  });
});
