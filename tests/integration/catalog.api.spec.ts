/**
 * Integration Test Suite: Catalog & Storefront Discovery APIs
 *
 * Tests:
 * 1. Category tree hierarchy retrieval & individual category lookup by slug
 * 2. Product listing (PLP) with category filter, price range filter, sorting (price_asc, price_desc, newest), and pagination
 * 3. Product detail lookup (PDP) by slug: active variants, prices, inventory availability, and unpublished 404 hiding
 * 4. Search API: exact match, partial match, brand filter, and empty query validation (422)
 *
 * Complies with PRD Section 9.1, Section 17.3, Section 18.2, and API_CONTRACT_V1.md Section 3.2.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

// Import Route Handlers
import { GET as getCategoriesRoute } from "@/app/api/v1/categories/route";
import { GET as getCategoryBySlugRoute } from "@/app/api/v1/categories/[slug]/route";
import { GET as getProductsRoute } from "@/app/api/v1/products/route";
import { GET as getProductBySlugRoute } from "@/app/api/v1/products/[slug]/route";
import { GET as searchProductsRoute } from "@/app/api/v1/search/route";

describe("Integration: Catalog & Storefront Discovery APIs", () => {
  let draftProductId: string | null = null;
  const draftProductSlug = `draft-product-${Date.now()}`;

  beforeAll(async () => {
    // Resolve a valid category for temporary draft product
    const category = await prisma.category.findFirst({
      where: { slug: "electronics" },
    });
    expect(category).not.toBeNull();

    // Create an unpublished (DRAFT) product to test 404 concealment
    const draftProduct = await prisma.product.create({
      data: {
        categoryId: category!.id,
        slug: draftProductSlug,
        title: "Secret Unreleased Gadget",
        description: "Confidential internal prototype.",
        status: "DRAFT",
        brandName: "TopSecret",
        variants: {
          create: {
            sku: `DRAFT-SKU-${Date.now()}`,
            title: "Prototype",
            attributesJson: JSON.stringify({ version: "v0.1" }),
            status: "ACTIVE",
            prices: {
              create: {
                currency: "USD",
                amountMinor: 99900,
              },
            },
            inventory: {
              create: {
                onHandQuantity: 10,
                reservedQuantity: 0,
                safetyStock: 2,
              },
            },
          },
        },
      },
    });
    draftProductId = draftProduct.id;
  });

  afterAll(async () => {
    // Clean up temporary draft product
    if (draftProductId) {
      await prisma.price.deleteMany({
        where: { variant: { productId: draftProductId } },
      });
      await prisma.inventory.deleteMany({
        where: { variant: { productId: draftProductId } },
      });
      await prisma.productVariant.deleteMany({
        where: { productId: draftProductId },
      });
      await prisma.product.deleteMany({
        where: { id: draftProductId },
      });
    }
  });

  // ===========================================================================
  // 1. Categories Hierarchy & Slug Lookup
  // ===========================================================================
  describe("1. Category Hierarchy & Slug Lookup", () => {
    it("should retrieve full active category tree (200 OK)", async () => {
      const req = new NextRequest("http://localhost:3000/api/v1/categories");
      const res = await getCategoriesRoute(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(Array.isArray(json.data)).toBe(true);
      expect(json.data.length).toBeGreaterThanOrEqual(3);

      // Verify root categories
      const rootSlugs = json.data.map((c: any) => c.slug);
      expect(rootSlugs).toContain("electronics");
      expect(rootSlugs).toContain("apparel");
      expect(rootSlugs).toContain("home-living");

      // Verify nested children structure
      const electronics = json.data.find((c: any) => c.slug === "electronics");
      expect(electronics).toBeDefined();
      expect(electronics.children.length).toBeGreaterThanOrEqual(3);

      const childSlugs = electronics.children.map((ch: any) => ch.slug);
      expect(childSlugs).toContain("audio-headphones");
      expect(childSlugs).toContain("laptops");
      expect(childSlugs).toContain("smartphones");

      // Verify sortOrder ordering
      for (let i = 1; i < json.data.length; i++) {
        expect(json.data[i].sortOrder).toBeGreaterThanOrEqual(json.data[i - 1].sortOrder);
      }
    });

    it("should retrieve individual root category by slug with children (200 OK)", async () => {
      const req = new NextRequest("http://localhost:3000/api/v1/categories/electronics");
      const res = await getCategoryBySlugRoute(req, {
        params: Promise.resolve({ slug: "electronics" }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.slug).toBe("electronics");
      expect(json.data.name).toBe("Electronics");
      expect(json.data.parent).toBeNull();
      expect(json.data.children.length).toBeGreaterThanOrEqual(3);
      expect(json.data.children.some((c: any) => c.productCount >= 1)).toBe(true);
    });

    it("should retrieve individual subcategory with parent relation (200 OK)", async () => {
      const req = new NextRequest("http://localhost:3000/api/v1/categories/audio-headphones");
      const res = await getCategoryBySlugRoute(req, {
        params: Promise.resolve({ slug: "audio-headphones" }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.slug).toBe("audio-headphones");
      expect(json.data.name).toBe("Audio & Headphones");
      expect(json.data.parent).not.toBeNull();
      expect(json.data.parent.slug).toBe("electronics");
      expect(json.data.parent.name).toBe("Electronics");
    });

    it("should return 404 when category slug does not exist", async () => {
      const req = new NextRequest("http://localhost:3000/api/v1/categories/non-existent-category");
      const res = await getCategoryBySlugRoute(req, {
        params: Promise.resolve({ slug: "non-existent-category" }),
      });
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.error.code).toBe("CATEGORY_NOT_FOUND");
    });

    it("should return 422 when category slug format is invalid", async () => {
      const req = new NextRequest("http://localhost:3000/api/v1/categories/INVALID_UPPERCASE_SLUG");
      const res = await getCategoryBySlugRoute(req, {
        params: Promise.resolve({ slug: "INVALID_UPPERCASE_SLUG" }),
      });
      const json = await res.json();

      expect(res.status).toBe(422);
      expect(json.error.code).toBe("VALIDATION_ERROR");
    });
  });

  // ===========================================================================
  // 2. Product Listing, Filters, Sorting, and Pagination
  // ===========================================================================
  describe("2. Product Listing (PLP) with Filters, Sorting & Pagination", () => {
    it("should return all published catalog products with pagination metadata (200 OK)", async () => {
      const req = new NextRequest("http://localhost:3000/api/v1/products?page=1&limit=20");
      const res = await getProductsRoute(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(Array.isArray(json.data)).toBe(true);
      expect(json.data.length).toBe(8); // 8 published products seeded

      expect(json.meta.pagination).toBeDefined();
      expect(json.meta.pagination.total).toBe(8);
      expect(json.meta.pagination.page).toBe(1);
      expect(json.meta.pagination.limit).toBe(20);
      expect(json.meta.pagination.totalPages).toBe(1);
      expect(json.meta.pagination.hasNext).toBe(false);

      // Verify structure of product summary items
      const first = json.data[0];
      expect(first.id).toBeDefined();
      expect(first.slug).toBeDefined();
      expect(first.title).toBeDefined();
      expect(first.brandName).toBeDefined();
      expect(first.category).toBeDefined();
      expect(first.priceRange).toBeDefined();
      expect(Number.isInteger(first.priceRange.minAmountMinor)).toBe(true);
      expect(Number.isInteger(first.priceRange.maxAmountMinor)).toBe(true);
      expect(first.priceRange.currency).toBe("USD");
      expect(first.stockStatus).toMatch(/^(IN_STOCK|LOW_STOCK|OUT_OF_STOCK)$/);
    });

    it("should filter products by category including descendant subcategories (200 OK)", async () => {
      // Electronics root category should include products from smartphones, laptops, and audio-headphones
      const req = new NextRequest("http://localhost:3000/api/v1/products?category=electronics");
      const res = await getProductsRoute(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.length).toBe(3);

      const slugs = json.data.map((p: any) => p.slug);
      expect(slugs).toContain("quantum-wireless-headphones");
      expect(slugs).toContain("aerobook-ultra-14-laptop");
      expect(slugs).toContain("apex-pro-5g-smartphone");
    });

    it("should filter products by leaf subcategory specifically (200 OK)", async () => {
      const req = new NextRequest("http://localhost:3000/api/v1/products?category=audio-headphones");
      const res = await getProductsRoute(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.length).toBe(1);
      expect(json.data[0].slug).toBe("quantum-wireless-headphones");
      expect(json.data[0].category.slug).toBe("audio-headphones");
    });

    it("should return empty list when filtering by non-existent category (200 OK)", async () => {
      const req = new NextRequest("http://localhost:3000/api/v1/products?category=unknown-category");
      const res = await getProductsRoute(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.length).toBe(0);
      expect(json.meta.pagination.total).toBe(0);
    });

    it("should filter products within minor unit price range (200 OK)", async () => {
      // Products between $20.00 (2000 minor) and $50.00 (5000 minor)
      const req = new NextRequest("http://localhost:3000/api/v1/products?minPrice=2000&maxPrice=5000");
      const res = await getProductsRoute(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.length).toBeGreaterThan(0);

      for (const item of json.data) {
        // Product's active prices must fall within the range
        expect(item.priceRange.minAmountMinor).toBeLessThanOrEqual(5000);
        expect(item.priceRange.maxAmountMinor).toBeGreaterThanOrEqual(2000);
      }
    });

    it("should sort products by price ascending (price_asc)", async () => {
      const req = new NextRequest("http://localhost:3000/api/v1/products?sortBy=price_asc");
      const res = await getProductsRoute(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.length).toBeGreaterThanOrEqual(2);

      for (let i = 1; i < json.data.length; i++) {
        const prevPrice = json.data[i - 1].priceRange.minAmountMinor;
        const currPrice = json.data[i].priceRange.minAmountMinor;
        expect(currPrice).toBeGreaterThanOrEqual(prevPrice);
      }
    });

    it("should sort products by price descending (price_desc)", async () => {
      const req = new NextRequest("http://localhost:3000/api/v1/products?sortBy=price_desc");
      const res = await getProductsRoute(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.length).toBeGreaterThanOrEqual(2);

      for (let i = 1; i < json.data.length; i++) {
        const prevPrice = json.data[i - 1].priceRange.minAmountMinor;
        const currPrice = json.data[i].priceRange.minAmountMinor;
        expect(currPrice).toBeLessThanOrEqual(prevPrice);
      }
    });

    it("should sort products by newest creation date (newest)", async () => {
      const req = new NextRequest("http://localhost:3000/api/v1/products?sortBy=newest");
      const res = await getProductsRoute(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.length).toBeGreaterThanOrEqual(2);

      for (let i = 1; i < json.data.length; i++) {
        const prevTime = new Date(json.data[i - 1].createdAt).getTime();
        const currTime = new Date(json.data[i].createdAt).getTime();
        expect(prevTime).toBeGreaterThanOrEqual(currTime);
      }
    });

    it("should paginate catalog correctly across page boundaries", async () => {
      // Request Page 1 with limit 3
      const req1 = new NextRequest("http://localhost:3000/api/v1/products?page=1&limit=3&sortBy=price_asc");
      const res1 = await getProductsRoute(req1);
      const json1 = await res1.json();

      expect(res1.status).toBe(200);
      expect(json1.data.length).toBe(3);
      expect(json1.meta.pagination.page).toBe(1);
      expect(json1.meta.pagination.limit).toBe(3);
      expect(json1.meta.pagination.total).toBe(8);
      expect(json1.meta.pagination.totalPages).toBe(3);
      expect(json1.meta.pagination.hasNext).toBe(true);
      expect(json1.meta.pagination.hasPrev).toBe(false);

      // Request Page 2 with limit 3
      const req2 = new NextRequest("http://localhost:3000/api/v1/products?page=2&limit=3&sortBy=price_asc");
      const res2 = await getProductsRoute(req2);
      const json2 = await res2.json();

      expect(res2.status).toBe(200);
      expect(json2.data.length).toBe(3);
      expect(json2.meta.pagination.page).toBe(2);
      expect(json2.meta.pagination.hasNext).toBe(true);
      expect(json2.meta.pagination.hasPrev).toBe(true);

      // Ensure no overlapping products between page 1 and page 2
      const page1Ids = json1.data.map((p: any) => p.id);
      const page2Ids = json2.data.map((p: any) => p.id);
      for (const id of page2Ids) {
        expect(page1Ids).not.toContain(id);
      }
    });

    it("should filter for in-stock products only (inStockOnly=true)", async () => {
      const req = new NextRequest("http://localhost:3000/api/v1/products?inStockOnly=true");
      const res = await getProductsRoute(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      for (const product of json.data) {
        expect(product.inStock).toBe(true);
        expect(product.availableStock).toBeGreaterThan(0);
      }
    });

    it("should reject invalid query parameters with 422 Unprocessable Entity", async () => {
      const req = new NextRequest("http://localhost:3000/api/v1/products?sortBy=invalid_sort_option");
      const res = await getProductsRoute(req);
      const json = await res.json();

      expect(res.status).toBe(422);
      expect(json.error.code).toBe("VALIDATION_ERROR");
    });
  });

  // ===========================================================================
  // 3. Product Detail (PDP) Lookup by Slug
  // ===========================================================================
  describe("3. Product Detail (PDP) Lookup by Slug", () => {
    it("should retrieve published product with variants, media, and pricing (200 OK)", async () => {
      const req = new NextRequest("http://localhost:3000/api/v1/products/quantum-wireless-headphones");
      const res = await getProductBySlugRoute(req, {
        params: Promise.resolve({ slug: "quantum-wireless-headphones" }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.slug).toBe("quantum-wireless-headphones");
      expect(json.data.title).toBe("Quantum Wireless Noise-Cancelling Headphones");
      expect(json.data.brandName).toBe("AcoustiQ");
      expect(json.data.status).toBe("PUBLISHED");

      // Verify category
      expect(json.data.category.slug).toBe("audio-headphones");
      expect(json.data.category.name).toBe("Audio & Headphones");

      // Verify media gallery
      expect(Array.isArray(json.data.media)).toBe(true);
      expect(json.data.media.length).toBeGreaterThanOrEqual(1);
      expect(json.data.media.some((m: any) => m.isThumbnail)).toBe(true);

      // Verify active variants
      expect(Array.isArray(json.data.variants)).toBe(true);
      expect(json.data.variants.length).toBe(3); // BLK (50 stock), SLV (4 stock), WHT (0 stock)

      // Test In-Stock variant
      const blkVariant = json.data.variants.find((v: any) => v.sku === "QW-NC-BLK");
      expect(blkVariant).toBeDefined();
      expect(blkVariant.title).toBe("Midnight Black");
      expect(blkVariant.attributes.color).toBe("Midnight Black");
      expect(blkVariant.price.amountMinor).toBe(19999);
      expect(blkVariant.price.compareAtAmountMinor).toBe(24999);
      expect(blkVariant.stockStatus).toBe("IN_STOCK");
      expect(blkVariant.inventory.isAvailable).toBe(true);
      expect(blkVariant.inventory.availableQuantity).toBe(50);
      expect(blkVariant.savingsBadge).toContain("Save 20%");

      // Test Low-Stock variant (3 on hand, safety stock 5 -> badge "Only 3 left")
      const slvVariant = json.data.variants.find((v: any) => v.sku === "QW-NC-SLV");
      expect(slvVariant).toBeDefined();
      expect(slvVariant.stockStatus).toBe("LOW_STOCK");
      expect(slvVariant.stockBadgeText).toBe("Only 3 left");
      expect(slvVariant.inventory.availableQuantity).toBe(3);

      // Test Out-Of-Stock variant (0 on hand -> badge "Out of Stock")
      const outOfStockVariant = json.data.variants.find((v: any) => v.sku === "QW-NC-ROSE");
      expect(outOfStockVariant).toBeDefined();
      expect(outOfStockVariant.stockStatus).toBe("OUT_OF_STOCK");
      expect(outOfStockVariant.stockBadgeText).toBe("Out of Stock");
      expect(outOfStockVariant.inventory.isAvailable).toBe(false);
    });

    it("should return 404 for an unpublished (DRAFT) product to conceal internal drafts", async () => {
      const req = new NextRequest(`http://localhost:3000/api/v1/products/${draftProductSlug}`);
      const res = await getProductBySlugRoute(req, {
        params: Promise.resolve({ slug: draftProductSlug }),
      });
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.error.code).toBe("PRODUCT_NOT_FOUND");
    });

    it("should return 404 for non-existent product slug", async () => {
      const req = new NextRequest("http://localhost:3000/api/v1/products/does-not-exist");
      const res = await getProductBySlugRoute(req, {
        params: Promise.resolve({ slug: "does-not-exist" }),
      });
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.error.code).toBe("PRODUCT_NOT_FOUND");
    });

    it("should return 422 for invalid slug format", async () => {
      const req = new NextRequest("http://localhost:3000/api/v1/products/BAD_SLUG_WITH_UNDERSCORES_AND_CAPS");
      const res = await getProductBySlugRoute(req, {
        params: Promise.resolve({ slug: "BAD_SLUG_WITH_UNDERSCORES_AND_CAPS" }),
      });
      const json = await res.json();

      expect(res.status).toBe(422);
      expect(json.error.code).toBe("VALIDATION_ERROR");
    });
  });

  // ===========================================================================
  // 4. Search API (Exact match, Partial match, Brand filter, Empty validation)
  // ===========================================================================
  describe("4. Catalog Search API", () => {
    it("should find product by exact title match (200 OK)", async () => {
      const req = new NextRequest("http://localhost:3000/api/v1/search?q=Quantum Wireless Noise-Cancelling Headphones");
      const res = await searchProductsRoute(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.length).toBe(1);
      expect(json.data[0].slug).toBe("quantum-wireless-headphones");
    });

    it("should find products by partial query matching title or description (200 OK)", async () => {
      const req = new NextRequest("http://localhost:3000/api/v1/search?q=wireless");
      const res = await searchProductsRoute(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.length).toBeGreaterThanOrEqual(1);
      expect(json.data.some((p: any) => p.slug === "quantum-wireless-headphones")).toBe(true);
    });

    it("should find products by matching brand name (200 OK)", async () => {
      const req = new NextRequest("http://localhost:3000/api/v1/search?q=Terra Apparel");
      const res = await searchProductsRoute(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.length).toBeGreaterThanOrEqual(1);
      for (const p of json.data) {
        expect(p.brandName).toBe("Terra Apparel");
      }
    });

    it("should filter search results by brand query parameter (200 OK)", async () => {
      // Query "cotton" with brand "Terra Apparel" matches
      const req1 = new NextRequest("http://localhost:3000/api/v1/search?q=cotton&brand=Terra Apparel");
      const res1 = await searchProductsRoute(req1);
      const json1 = await res1.json();

      expect(res1.status).toBe(200);
      expect(json1.data.length).toBeGreaterThanOrEqual(1);
      expect(json1.data[0].brandName).toBe("Terra Apparel");

      // Query "cotton" with incompatible brand "AcoustiQ" yields 0 matches
      const req2 = new NextRequest("http://localhost:3000/api/v1/search?q=cotton&brand=AcoustiQ");
      const res2 = await searchProductsRoute(req2);
      const json2 = await res2.json();

      expect(res2.status).toBe(200);
      expect(json2.data.length).toBe(0);
    });

    it("should reject empty query parameter with 422 Unprocessable Entity", async () => {
      // Empty query string
      const req1 = new NextRequest("http://localhost:3000/api/v1/search?q=");
      const res1 = await searchProductsRoute(req1);
      const json1 = await res1.json();

      expect(res1.status).toBe(422);
      expect(json1.error.code).toBe("VALIDATION_ERROR");

      // Whitespace only query string
      const req2 = new NextRequest("http://localhost:3000/api/v1/search?q=%20%20%20");
      const res2 = await searchProductsRoute(req2);
      const json2 = await res2.json();

      expect(res2.status).toBe(422);
      expect(json2.error.code).toBe("VALIDATION_ERROR");

      // Missing 'q' parameter completely
      const req3 = new NextRequest("http://localhost:3000/api/v1/search");
      const res3 = await searchProductsRoute(req3);
      const json3 = await res3.json();

      expect(res3.status).toBe(422);
      expect(json3.error.code).toBe("VALIDATION_ERROR");
    });
  });
});
