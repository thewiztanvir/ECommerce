/**
 * Catalog & Storefront Discovery Domain Service
 * Complies with PRD Section 9.1, Section 17.3, Section 18.2, and API_CONTRACT_V1.md.
 *
 * Responsibilities:
 * 1. Category hierarchy resolution (active category tree with product counts).
 * 2. Category detail by slug with parent/child navigation relations & breadcrumbs.
 * 3. Paginated, filterable, and deterministically sorted product listing (PLP).
 * 4. Detailed product view by slug with full variant attributes, active pricing (minor units),
 *    media gallery, breadcrumbs, and real-time inventory availability (PDP).
 * 5. Full-text / substring search across title, description, brand, and SKU.
 *
 * Rules:
 * - All monetary values MUST be integer minor units (cents).
 * - Never trust client-submitted prices or stock availability.
 * - Always filter by published/active statuses for storefront consumers.
 * - Zero `any` types.
 */

import { prisma, type Prisma } from "../../lib/db";
import { MoneyEngine } from "../../lib/money";
import type { SortOption } from "../../lib/validations/catalog.schema";

// =============================================================================
// Domain Error & Type Definitions
// =============================================================================

export class CatalogError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 400,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "CatalogError";
  }
}

export interface CategoryTreeItem {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  sortOrder: number;
  productCount: number;
  children: CategoryTreeItem[];
}

export interface CategoryDetail {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  sortOrder: number;
  productCount: number;
  breadcrumbs?: Array<{ name: string; href: string }>;
  parent: {
    id: string;
    slug: string;
    name: string;
  } | null;
  children: Array<{
    id: string;
    slug: string;
    name: string;
    description: string | null;
    productCount: number;
  }>;
}

export interface PriceRange {
  minAmountMinor: number;
  maxAmountMinor: number;
  currency: string;
}

export type StockStatus = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";

export interface CatalogVariant {
  id: string;
  sku: string;
  barcode: string | null;
  title: string;
  attributes: Record<string, string>;
  stockStatus: StockStatus;
  stockBadgeText: string;
  savingsBadge: string | null;
  availableStock: number;
  formattedPrice: string;
  formattedCompareAtPrice: string | null;
  priceMinor: number;
  compareAtMinor: number | null;
  price: {
    currency: string;
    amountMinor: number;
    compareAtAmountMinor: number | null;
  } | null;
  inventory: {
    isAvailable: boolean;
    availableQuantity: number;
  };
}

export interface CatalogProductSummary {
  id: string;
  slug: string;
  title: string;
  description: string;
  brandName: string | null;
  category: {
    id: string;
    slug: string;
    name: string;
  };
  price: {
    currency: string;
    amountMinor: number;
    compareAtAmountMinor?: number | null;
  };
  priceRange: PriceRange;
  priceMinor: number;
  compareAtMinor: number | null;
  formattedPrice: string;
  formattedCompareAtPrice: string | null;
  stockStatus: StockStatus;
  stockBadgeText: string;
  savingsBadge: string | null;
  availableStock: number;
  thumbnailUrl: string | null;
  inStock: boolean;
  variantsCount: number;
  createdAt: string;
}

export interface CatalogProductDetail {
  id: string;
  slug: string;
  title: string;
  description: string;
  brandName: string | null;
  status: string;
  category: {
    id: string;
    slug: string;
    name: string;
  };
  breadcrumbs?: Array<{ name: string; href: string }>;
  media: Array<{
    id: string;
    url: string;
    altText: string;
    sortOrder: number;
    isThumbnail: boolean;
  }>;
  variants: CatalogVariant[];
  createdAt: string;
  updatedAt: string;
}

// Aliases for compatibility with UI components and API controllers
export type ProductListItem = CatalogProductSummary;
export type ProductDetail = CatalogProductDetail;
export type ProductVariantDetail = CatalogVariant;

export interface ListProductsParams {
  categorySlug?: string;
  minPrice?: number;
  maxPrice?: number;
  minPriceMinor?: number;
  maxPriceMinor?: number;
  sort?: SortOption | "price-asc" | "price-desc";
  page?: number;
  limit?: number;
  inStockOnly?: boolean;
  q?: string;
}

export interface ListProductsResult {
  items: CatalogProductSummary[];
  products: CatalogProductSummary[];
  total: number;
  totalPages: number;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  facets?: {
    categories: Array<{ slug: string; name: string; count: number }>;
    priceBounds?: {
      minMinor: number;
      maxMinor: number;
      currency: string;
    };
  };
}

export interface ListProductsByCategoryParams {
  categorySlug: string;
  sort?: "newest" | "price-asc" | "price-desc" | "price_asc" | "price_desc" | "featured";
  minPriceMinor?: number;
  maxPriceMinor?: number;
  page?: number;
  limit?: number;
}

export interface ListProductsByCategoryResult {
  category: {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    breadcrumbs: Array<{ name: string; href: string }>;
  } | null;
  products: CatalogProductSummary[];
  total: number;
  totalPages: number;
}

// =============================================================================
// Helper Functions
// =============================================================================

function normalizeSortOption(
  rawSort?: string
): SortOption {
  if (!rawSort) return "featured";
  if (rawSort === "price-asc") return "price_asc";
  if (rawSort === "price-desc") return "price_desc";
  if (
    rawSort === "price_asc" ||
    rawSort === "price_desc" ||
    rawSort === "newest" ||
    rawSort === "featured"
  ) {
    return rawSort;
  }
  return "featured";
}

/**
 * Resolves the active price for a variant given the current timestamp.
 */
function resolveActiveVariantPrice(
  prices: Array<{
    id: string;
    currency: string;
    amountMinor: number;
    compareAtAmountMinor: number | null;
    effectiveFrom: Date;
    effectiveTo: Date | null;
  }>,
  targetCurrency = "USD"
) {
  const now = new Date();
  const validPrices = prices.filter(
    (p) =>
      p.effectiveFrom <= now &&
      (p.effectiveTo === null || p.effectiveTo > now)
  );

  if (validPrices.length === 0) {
    const fallback = prices.find((p) => p.currency === targetCurrency) ?? prices[0];
    return fallback ?? null;
  }

  const currencyMatch = validPrices.find((p) => p.currency === targetCurrency);
  if (currencyMatch) return currencyMatch;

  return validPrices.sort((a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime())[0];
}

/**
 * Safely parses attributes JSON stored on ProductVariant.
 */
function parseAttributes(raw: string): Record<string, string> {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const result: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed)) {
        result[k] = String(v);
      }
      return result;
    }
    return {};
  } catch {
    return {};
  }
}

/**
 * Derives stock status, stock badge text, and savings badge.
 */
function deriveDisplayBadges(
  availableStock: number,
  priceMinor: number,
  compareAtMinor: number | null
): {
  stockStatus: StockStatus;
  stockBadgeText: string;
  savingsBadge: string | null;
} {
  let stockStatus: StockStatus = "IN_STOCK";
  let stockBadgeText = "In Stock";

  if (availableStock <= 0) {
    stockStatus = "OUT_OF_STOCK";
    stockBadgeText = "Out of Stock";
  } else if (availableStock <= 5) {
    stockStatus = "LOW_STOCK";
    stockBadgeText = `Only ${availableStock} left`;
  }

  let savingsBadge: string | null = null;
  if (compareAtMinor && compareAtMinor > priceMinor) {
    const percentage = Math.round(
      ((compareAtMinor - priceMinor) / compareAtMinor) * 100
    );
    if (percentage > 0) {
      savingsBadge = `Save ${percentage}%`;
    }
  }

  return { stockStatus, stockBadgeText, savingsBadge };
}

// =============================================================================
// Catalog Service Class
// =============================================================================

export class CatalogService {
  /**
   * Retrieves active category hierarchy tree with product counts.
   * Complies with API_CONTRACT_V1.md Section 3.2.3.
   */
  async listCategories(): Promise<CategoryTreeItem[]> {
    const rawCategories = await prisma.category.findMany({
      where: { status: "ACTIVE" },
      orderBy: { sortOrder: "asc" },
      include: {
        _count: {
          select: {
            products: {
              where: { status: "PUBLISHED" },
            },
          },
        },
      },
    });

    const nodeMap = new Map<string, CategoryTreeItem>();
    for (const cat of rawCategories) {
      nodeMap.set(cat.id, {
        id: cat.id,
        slug: cat.slug,
        name: cat.name,
        description: cat.description,
        imageUrl: cat.imageUrl,
        sortOrder: cat.sortOrder,
        productCount: cat._count.products,
        children: [],
      });
    }

    const rootNodes: CategoryTreeItem[] = [];
    for (const cat of rawCategories) {
      const node = nodeMap.get(cat.id)!;
      if (cat.parentId && nodeMap.has(cat.parentId)) {
        nodeMap.get(cat.parentId)!.children.push(node);
      } else {
        rootNodes.push(node);
      }
    }

    return rootNodes;
  }

  /**
   * Retrieves single category by slug with parent & child navigation relations.
   */
  async getCategoryBySlug(slug: string): Promise<CategoryDetail | null> {
    const category = await prisma.category.findUnique({
      where: { slug },
      include: {
        parent: {
          select: {
            id: true,
            slug: true,
            name: true,
          },
        },
        children: {
          where: { status: "ACTIVE" },
          orderBy: { sortOrder: "asc" },
          include: {
            _count: {
              select: {
                products: {
                  where: { status: "PUBLISHED" },
                },
              },
            },
          },
        },
        _count: {
          select: {
            products: {
              where: { status: "PUBLISHED" },
            },
          },
        },
      },
    });

    if (!category || category.status !== "ACTIVE") {
      return null;
    }

    const breadcrumbs = [
      { name: "Home", href: "/" },
      ...(category.parent
        ? [{ name: category.parent.name, href: `/category/${category.parent.slug}` }]
        : []),
      { name: category.name, href: `/category/${category.slug}` },
    ];

    return {
      id: category.id,
      slug: category.slug,
      name: category.name,
      description: category.description,
      imageUrl: category.imageUrl,
      sortOrder: category.sortOrder,
      productCount: category._count.products,
      breadcrumbs,
      parent: category.parent,
      children: category.children.map((child) => ({
        id: child.id,
        slug: child.slug,
        name: child.name,
        description: child.description,
        productCount: child._count.products,
      })),
    };
  }

  /**
   * Retrieves single published product by slug with full variant details,
   * active minor-unit prices, media, breadcrumbs, and real-time inventory availability.
   * Complies with API_CONTRACT_V1.md Section 3.2.2.
   */
  async getProductBySlug(slug: string): Promise<CatalogProductDetail | null> {
    const product = await prisma.product.findUnique({
      where: { slug },
      include: {
        category: {
          select: {
            id: true,
            slug: true,
            name: true,
          },
        },
        media: {
          orderBy: [{ isThumbnail: "desc" }, { sortOrder: "asc" }],
        },
        variants: {
          where: { status: "ACTIVE" },
          include: {
            prices: true,
            inventory: true,
          },
        },
      },
    });

    if (!product || product.status !== "PUBLISHED") {
      return null;
    }

    const variants: CatalogVariant[] = product.variants.map((v) => {
      const activePrice = resolveActiveVariantPrice(v.prices);
      const onHand = v.inventory?.onHandQuantity ?? 0;
      const reserved = v.inventory?.reservedQuantity ?? 0;
      const availableStock = Math.max(0, onHand - reserved);
      const priceMinor = activePrice?.amountMinor ?? 0;
      const compareAtMinor = activePrice?.compareAtAmountMinor ?? null;

      const { stockStatus, stockBadgeText, savingsBadge } = deriveDisplayBadges(
        availableStock,
        priceMinor,
        compareAtMinor
      );

      const formattedPrice = MoneyEngine.format({
        amountMinor: priceMinor,
        currency: activePrice?.currency ?? "USD",
      });

      const formattedCompareAtPrice = compareAtMinor
        ? MoneyEngine.format({
            amountMinor: compareAtMinor,
            currency: activePrice?.currency ?? "USD",
          })
        : null;

      return {
        id: v.id,
        sku: v.sku,
        barcode: v.barcode,
        title: v.title,
        attributes: parseAttributes(v.attributesJson),
        stockStatus,
        stockBadgeText,
        savingsBadge,
        availableStock,
        formattedPrice,
        formattedCompareAtPrice,
        priceMinor,
        compareAtMinor,
        price: activePrice
          ? {
              currency: activePrice.currency,
              amountMinor: activePrice.amountMinor,
              compareAtAmountMinor: activePrice.compareAtAmountMinor,
            }
          : null,
        inventory: {
          isAvailable: availableStock > 0,
          availableQuantity: availableStock,
        },
      };
    });

    const breadcrumbs = [
      { name: "Home", href: "/" },
      { name: product.category.name, href: `/category/${product.category.slug}` },
      { name: product.title, href: `/product/${product.slug}` },
    ];

    return {
      id: product.id,
      slug: product.slug,
      title: product.title,
      description: product.description,
      brandName: product.brandName,
      status: product.status,
      category: product.category,
      breadcrumbs,
      media: product.media.map((m) => ({
        id: m.id,
        url: m.url,
        altText: m.altText,
        sortOrder: m.sortOrder,
        isThumbnail: m.isThumbnail,
      })),
      variants,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
    };
  }

  /**
   * Retrieves paginated, filterable, and deterministically sorted products list.
   * Complies with API_CONTRACT_V1.md Section 3.2.1.
   */
  async listProducts(params: ListProductsParams = {}): Promise<ListProductsResult> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));
    const sort = normalizeSortOption(params.sort);
    const minPriceFilter = params.minPriceMinor ?? params.minPrice;
    const maxPriceFilter = params.maxPriceMinor ?? params.maxPrice;

    // 1. Resolve Category Scope (including active descendant categories)
    let categoryIds: string[] | undefined;
    if (params.categorySlug) {
      const category = await prisma.category.findUnique({
        where: { slug: params.categorySlug, status: "ACTIVE" },
        include: { children: { select: { id: true, status: true } } },
      });

      if (!category) {
        return {
          items: [],
          products: [],
          total: 0,
          totalPages: 0,
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
            hasNext: false,
            hasPrev: false,
          },
        };
      }

      const activeChildIds = category.children
        .filter((c) => c.status === "ACTIVE")
        .map((c) => c.id);
      categoryIds = [category.id, ...activeChildIds];
    }

    // 2. Build Base Prisma Where Filter
    const where: Prisma.ProductWhereInput = {
      status: "PUBLISHED",
    };

    if (categoryIds && categoryIds.length > 0) {
      where.categoryId = { in: categoryIds };
    }

    // Search query across title, description, brandName, and variant SKU
    if (params.q && params.q.trim().length > 0) {
      const query = params.q.trim();
      where.OR = [
        { title: { contains: query } },
        { description: { contains: query } },
        { brandName: { contains: query } },
        {
          variants: {
            some: {
              sku: { contains: query },
            },
          },
        },
      ];
    }

    // 3. Fetch Candidate Products with Variants, Prices & Inventory
    const candidateProducts = await prisma.product.findMany({
      where,
      include: {
        category: {
          select: {
            id: true,
            slug: true,
            name: true,
          },
        },
        media: {
          orderBy: [{ isThumbnail: "desc" }, { sortOrder: "asc" }],
        },
        variants: {
          where: { status: "ACTIVE" },
          include: {
            prices: true,
            inventory: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // 4. Map & Evaluate Pricing, Stock, and In-Memory Filters
    type EvaluatedProduct = {
      item: CatalogProductSummary;
      minPriceMinor: number;
      maxPriceMinor: number;
      createdAtMs: number;
    };

    const evaluated: EvaluatedProduct[] = [];

    for (const prod of candidateProducts) {
      const activeVariants = prod.variants;
      if (activeVariants.length === 0) continue;

      let minPrice = Number.MAX_SAFE_INTEGER;
      let maxPrice = 0;
      let primaryPrice: {
        currency: string;
        amountMinor: number;
        compareAtAmountMinor?: number | null;
      } | null = null;
      let totalAvailableStock = 0;

      for (const v of activeVariants) {
        const activePrice = resolveActiveVariantPrice(v.prices);
        if (activePrice) {
          if (activePrice.amountMinor < minPrice) {
            minPrice = activePrice.amountMinor;
            primaryPrice = {
              currency: activePrice.currency,
              amountMinor: activePrice.amountMinor,
              compareAtAmountMinor: activePrice.compareAtAmountMinor,
            };
          }
          if (activePrice.amountMinor > maxPrice) {
            maxPrice = activePrice.amountMinor;
          }
        }

        const onHand = v.inventory?.onHandQuantity ?? 0;
        const reserved = v.inventory?.reservedQuantity ?? 0;
        const available = Math.max(0, onHand - reserved);
        totalAvailableStock += available;
      }

      // If no valid active price found, skip product from storefront
      if (!primaryPrice || minPrice === Number.MAX_SAFE_INTEGER) {
        continue;
      }

      const hasAvailableStock = totalAvailableStock > 0;

      // Filter: In stock only
      if (params.inStockOnly && !hasAvailableStock) {
        continue;
      }

      // Filter: Price Range
      if (minPriceFilter !== undefined && maxPrice < minPriceFilter) {
        continue;
      }
      if (maxPriceFilter !== undefined && minPrice > maxPriceFilter) {
        continue;
      }

      const thumbnail = prod.media.find((m) => m.isThumbnail) ?? prod.media[0];

      const { stockStatus, stockBadgeText, savingsBadge } = deriveDisplayBadges(
        totalAvailableStock,
        minPrice,
        primaryPrice.compareAtAmountMinor ?? null
      );

      const formattedPrice = MoneyEngine.format({
        amountMinor: minPrice,
        currency: primaryPrice.currency,
      });

      const formattedCompareAtPrice = primaryPrice.compareAtAmountMinor
        ? MoneyEngine.format({
            amountMinor: primaryPrice.compareAtAmountMinor,
            currency: primaryPrice.currency,
          })
        : null;

      const item: CatalogProductSummary = {
        id: prod.id,
        slug: prod.slug,
        title: prod.title,
        description: prod.description,
        brandName: prod.brandName,
        category: prod.category,
        price: primaryPrice,
        priceRange: {
          minAmountMinor: minPrice,
          maxAmountMinor: maxPrice,
          currency: primaryPrice.currency,
        },
        priceMinor: minPrice,
        compareAtMinor: primaryPrice.compareAtAmountMinor ?? null,
        formattedPrice,
        formattedCompareAtPrice,
        stockStatus,
        stockBadgeText,
        savingsBadge,
        availableStock: totalAvailableStock,
        thumbnailUrl: thumbnail ? thumbnail.url : null,
        inStock: hasAvailableStock,
        variantsCount: activeVariants.length,
        createdAt: prod.createdAt.toISOString(),
      };

      evaluated.push({
        item,
        minPriceMinor: minPrice,
        maxPriceMinor: maxPrice,
        createdAtMs: prod.createdAt.getTime(),
      });
    }

    // 5. Deterministic Multi-Attribute Sorting
    evaluated.sort((a, b) => {
      switch (sort) {
        case "price_asc":
          if (a.minPriceMinor !== b.minPriceMinor) {
            return a.minPriceMinor - b.minPriceMinor;
          }
          return a.item.id.localeCompare(b.item.id);

        case "price_desc":
          if (a.minPriceMinor !== b.minPriceMinor) {
            return b.minPriceMinor - a.minPriceMinor;
          }
          return b.item.id.localeCompare(a.item.id);

        case "newest":
          if (b.createdAtMs !== a.createdAtMs) {
            return b.createdAtMs - a.createdAtMs;
          }
          return b.item.id.localeCompare(a.item.id);

        case "featured":
        default:
          if (b.createdAtMs !== a.createdAtMs) {
            return b.createdAtMs - a.createdAtMs;
          }
          return a.item.id.localeCompare(b.item.id);
      }
    });

    // 6. Pagination Calculations
    const total = evaluated.length;
    const totalPages = Math.ceil(total / limit) || (total === 0 ? 0 : 1);
    const offset = (page - 1) * limit;
    const paginatedItems = evaluated.slice(offset, offset + limit).map((e) => e.item);

    // 7. Compute Facets for Filtered Universe
    const categoryCountsMap = new Map<string, { slug: string; name: string; count: number }>();
    let overallMinPrice = Number.MAX_SAFE_INTEGER;
    let overallMaxPrice = 0;

    for (const e of evaluated) {
      const cat = e.item.category;
      const existing = categoryCountsMap.get(cat.id);
      if (existing) {
        existing.count += 1;
      } else {
        categoryCountsMap.set(cat.id, { slug: cat.slug, name: cat.name, count: 1 });
      }

      if (e.minPriceMinor < overallMinPrice) overallMinPrice = e.minPriceMinor;
      if (e.maxPriceMinor > overallMaxPrice) overallMaxPrice = e.maxPriceMinor;
    }

    const categoriesFacet = Array.from(categoryCountsMap.values());
    const priceBoundsFacet =
      total > 0 && overallMinPrice !== Number.MAX_SAFE_INTEGER
        ? {
            minMinor: overallMinPrice,
            maxMinor: overallMaxPrice,
            currency: "USD",
          }
        : undefined;

    return {
      items: paginatedItems,
      products: paginatedItems,
      total,
      totalPages,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
      facets: {
        categories: categoriesFacet,
        priceBounds: priceBoundsFacet,
      },
    };
  }

  /**
   * Retrieves products for a specific category with category breadcrumbs.
   * Tailored for storefront CategoryPage.
   */
  async listProductsByCategory(
    params: ListProductsByCategoryParams
  ): Promise<ListProductsByCategoryResult> {
    const category = await this.getCategoryBySlug(params.categorySlug);
    if (!category) {
      return {
        category: null,
        products: [],
        total: 0,
        totalPages: 0,
      };
    }

    const result = await this.listProducts({
      categorySlug: params.categorySlug,
      sort: params.sort,
      minPriceMinor: params.minPriceMinor,
      maxPriceMinor: params.maxPriceMinor,
      page: params.page,
      limit: params.limit,
    });

    return {
      category: {
        id: category.id,
        slug: category.slug,
        name: category.name,
        description: category.description,
        breadcrumbs: category.breadcrumbs ?? [],
      },
      products: result.items,
      total: result.total,
      totalPages: result.totalPages,
    };
  }

  /**
   * Search products across title, description, brand, and SKU.
   * Supports both simple (query, page, limit) and structured params.
   * Complies with API_CONTRACT_V1.md Section 3.2.1.
   */
  async searchProducts(
    queryOrParams:
      | string
      | {
          query: string;
          sort?: string;
          minPriceMinor?: number;
          maxPriceMinor?: number;
          page?: number;
          limit?: number;
        },
    page = 1,
    limit = 20
  ): Promise<ListProductsResult> {
    if (typeof queryOrParams === "string") {
      return this.listProducts({
        q: queryOrParams,
        page,
        limit,
        sort: "featured",
      });
    }

    return this.listProducts({
      q: queryOrParams.query,
      sort: normalizeSortOption(queryOrParams.sort),
      minPriceMinor: queryOrParams.minPriceMinor,
      maxPriceMinor: queryOrParams.maxPriceMinor,
      page: queryOrParams.page,
      limit: queryOrParams.limit,
    });
  }

  // ===========================================================================
  // Static Helper Delegations for Direct Class Invocation
  // ===========================================================================
  static async listCategories(): Promise<CategoryTreeItem[]> {
    return catalogService.listCategories();
  }

  static async getCategoryBySlug(slug: string): Promise<CategoryDetail | null> {
    return catalogService.getCategoryBySlug(slug);
  }

  static async getProductBySlug(slug: string): Promise<CatalogProductDetail | null> {
    return catalogService.getProductBySlug(slug);
  }

  static async listProducts(params: ListProductsParams = {}): Promise<ListProductsResult> {
    return catalogService.listProducts(params);
  }

  static async listProductsByCategory(
    params: ListProductsByCategoryParams
  ): Promise<ListProductsByCategoryResult> {
    return catalogService.listProductsByCategory(params);
  }

  static async searchProducts(
    queryOrParams:
      | string
      | {
          query: string;
          sort?: string;
          minPriceMinor?: number;
          maxPriceMinor?: number;
          page?: number;
          limit?: number;
        },
    page = 1,
    limit = 20
  ): Promise<ListProductsResult> {
    return catalogService.searchProducts(queryOrParams, page, limit);
  }
}

export const catalogService = new CatalogService();
