/**
 * Shopping Cart, Guest Cart Merging & Coupon Engine Domain Service
 * Complies with PRD Section 6.5, Section 7.2, Section 10, Section 17.3, and API_CONTRACT_V1.md Section 3.3.
 *
 * Responsibilities:
 * 1. Guest & Customer cart resolution across session boundaries.
 * 2. Real-time inventory verification and strict purchase quantity limits (1 to 10).
 * 3. Authoritative monetary calculations in integer minor currency units (cents) via MoneyEngine.
 * 4. Guest cart merging upon authentication (summing quantities, inventory caps, MERGED status).
 * 5. Full coupon lifecycle validation (active status, date windows, max uses, min order value).
 *
 * Boundaries:
 * - ZERO binary floating point arithmetic; always use integer minor units (cents).
 * - Never trust client-submitted prices or stock availability.
 * - Zero `any` types.
 */

import { NextRequest } from "next/server";
import { prisma } from "../../lib/db";
import { MoneyEngine } from "../../lib/money";
import { generateSecureToken, hashToken } from "../../lib/crypto";
import { getAuthenticatedUserId } from "../auth/session.service";

// =============================================================================
// Constants & Configuration
// =============================================================================

export const CART_PURCHASE_LIMIT_PER_VARIANT = 10;
export const GUEST_CART_TTL_DAYS = 7;
export const CUSTOMER_CART_TTL_DAYS = 30;
export const FREE_SHIPPING_THRESHOLD_MINOR = 7500; // $75.00 in minor cents
export const STANDARD_SHIPPING_ESTIMATE_MINOR = 750; // $7.50 in minor cents
export const ESTIMATED_TAX_BPS = 850; // 8.5% sales tax rate (850 basis points)
export const DEFAULT_CURRENCY = "USD";

// =============================================================================
// Domain Error & Type Definitions
// =============================================================================

export class CartError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 400,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "CartError";
  }
}

export interface CartLineItem {
  id: string;
  variantId: string;
  sku: string;
  title: string;
  productTitle: string;
  variantTitle: string;
  productSlug: string;
  unitPriceMinor: number;
  quantity: number;
  totalMinor: number;
  thumbnailUrl: string | null;
  isAvailable: boolean;
  availableStock: number;
}

export interface CartSummary {
  itemCount: number;
  subtotalMinor: number;
  discountMinor: number;
  shippingMinor: number;
  taxMinor: number;
  totalMinor: number;
  currency: string;
}

export interface CartCoupon {
  code: string;
  type: "PERCENTAGE" | "FIXED_AMOUNT";
  valueMinor: number;
  appliedDiscountMinor: number;
}

export interface CartView {
  id: string;
  guestCartToken?: string;
  customerId?: string | null;
  status: string;
  expiresAt: string;
  items: CartLineItem[];
  summary: CartSummary;
  coupon?: CartCoupon | null;
  createdAt: string;
  updatedAt: string;
}

// In-memory registries for coupon state and active guest tokens
const cartCouponRegistry = new Map<string, string>();
const cartGuestTokenRegistry = new Map<string, string>();

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Resolves active price for variant given current timestamp.
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
  targetCurrency = DEFAULT_CURRENCY
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

// =============================================================================
// Cart Service Class
// =============================================================================

export class CartService {
  /**
   * Resolves or initializes an active Cart for either an authenticated customer
   * or an unauthenticated guest session.
   */
  async getOrCreateCart(identifier: {
    userId?: string;
    guestToken?: string;
  }): Promise<CartView> {
    const now = new Date();

    // 1. Authenticated User Resolution
    if (identifier.userId) {
      let cart = await prisma.cart.findFirst({
        where: {
          customerId: identifier.userId,
          status: "ACTIVE",
          expiresAt: { gt: now },
        },
      });

      if (!cart) {
        const expiresAt = new Date(
          now.getTime() + CUSTOMER_CART_TTL_DAYS * 24 * 60 * 60 * 1000
        );
        cart = await prisma.cart.create({
          data: {
            customerId: identifier.userId,
            status: "ACTIVE",
            expiresAt,
          },
        });
      }

      return this.getCart(cart.id);
    }

    // 2. Guest Token Resolution
    if (identifier.guestToken && identifier.guestToken.trim().length > 0) {
      const rawToken = identifier.guestToken.trim();
      const tokenHash = hashToken(rawToken);

      let cart = await prisma.cart.findFirst({
        where: {
          guestTokenHash: tokenHash,
          status: "ACTIVE",
          expiresAt: { gt: now },
        },
      });

      if (!cart) {
        const expiresAt = new Date(
          now.getTime() + GUEST_CART_TTL_DAYS * 24 * 60 * 60 * 1000
        );
        cart = await prisma.cart.create({
          data: {
            guestTokenHash: tokenHash,
            status: "ACTIVE",
            expiresAt,
          },
        });
      }

      cartGuestTokenRegistry.set(cart.id, rawToken);
      const cartView = await this.getCart(cart.id);
      cartView.guestCartToken = rawToken;
      return cartView;
    }

    // 3. New Guest Session Initialization
    const rawGuestToken = generateSecureToken(32);
    const tokenHash = hashToken(rawGuestToken);
    const expiresAt = new Date(
      now.getTime() + GUEST_CART_TTL_DAYS * 24 * 60 * 60 * 1000
    );

    const cart = await prisma.cart.create({
      data: {
        guestTokenHash: tokenHash,
        status: "ACTIVE",
        expiresAt,
      },
    });

    cartGuestTokenRegistry.set(cart.id, rawGuestToken);
    const cartView = await this.getCart(cart.id);
    cartView.guestCartToken = rawGuestToken;
    return cartView;
  }

  /**
   * Retrieves full cart representation with authoritatively calculated line items,
   * active pricing, inventory availability, and promotional summary.
   */
  async getCart(
    cartId: string,
    options?: { couponCode?: string }
  ): Promise<CartView> {
    const cart = await prisma.cart.findUnique({
      where: { id: cartId },
      include: {
        cartItems: {
          include: {
            variant: {
              include: {
                product: {
                  include: {
                    media: {
                      orderBy: [{ isThumbnail: "desc" }, { sortOrder: "asc" }],
                    },
                  },
                },
                prices: true,
                inventory: true,
              },
            },
          },
          orderBy: { addedAt: "asc" },
        },
      },
    });

    if (!cart || cart.status !== "ACTIVE") {
      throw new CartError("CART_NOT_FOUND", "Active cart not found.", 404);
    }

    // Evaluate Line Items
    const items: CartLineItem[] = [];
    let subtotalMinor = 0;
    let itemCount = 0;

    for (const item of cart.cartItems) {
      const variant = item.variant;
      const product = variant.product;
      const activePrice = resolveActiveVariantPrice(variant.prices);
      const unitPriceMinor = activePrice?.amountMinor ?? 0;
      const lineTotalMinor = unitPriceMinor * item.quantity;

      const onHand = variant.inventory?.onHandQuantity ?? 0;
      const reserved = variant.inventory?.reservedQuantity ?? 0;
      const availableStock = Math.max(0, onHand - reserved);

      const isAvailable =
        variant.status === "ACTIVE" &&
        product.status === "PUBLISHED" &&
        availableStock >= item.quantity;

      const thumbnail =
        product.media.find((m) => m.isThumbnail) ?? product.media[0];

      items.push({
        id: item.id,
        variantId: item.variantId,
        sku: variant.sku,
        title: `${product.title} - ${variant.title}`,
        productTitle: product.title,
        variantTitle: variant.title,
        productSlug: product.slug,
        unitPriceMinor,
        quantity: item.quantity,
        totalMinor: lineTotalMinor,
        thumbnailUrl: thumbnail ? thumbnail.url : null,
        isAvailable,
        availableStock,
      });

      subtotalMinor += lineTotalMinor;
      itemCount += item.quantity;
    }

    // Promotional Coupon Evaluation
    const couponCode = options?.couponCode ?? cartCouponRegistry.get(cart.id);
    let appliedCoupon: CartCoupon | null = null;
    let discountMinor = 0;

    if (couponCode && subtotalMinor > 0) {
      const validation = await this.evaluateCoupon(couponCode, subtotalMinor);
      if (validation.valid && validation.promotion) {
        discountMinor = validation.discountMinor;
        appliedCoupon = {
          code: validation.promotion.code,
          type: validation.promotion.type as "PERCENTAGE" | "FIXED_AMOUNT",
          valueMinor: validation.promotion.valueMinor,
          appliedDiscountMinor: discountMinor,
        };
      } else {
        // If coupon became invalid (e.g. subtotal fell below minOrder), clear registry
        cartCouponRegistry.delete(cart.id);
      }
    }

    // Shipping & Tax Estimation in Minor Units
    const taxableBase = Math.max(0, subtotalMinor - discountMinor);
    const shippingMinor =
      itemCount === 0
        ? 0
        : subtotalMinor >= FREE_SHIPPING_THRESHOLD_MINOR
        ? 0
        : STANDARD_SHIPPING_ESTIMATE_MINOR;

    const taxMinor =
      itemCount === 0
        ? 0
        : Math.round((taxableBase * ESTIMATED_TAX_BPS) / 10000);

    const totalMinor = taxableBase + shippingMinor + taxMinor;

    const summary: CartSummary = {
      itemCount,
      subtotalMinor,
      discountMinor,
      shippingMinor,
      taxMinor,
      totalMinor,
      currency: DEFAULT_CURRENCY,
    };

    const guestCartToken = cartGuestTokenRegistry.get(cart.id);

    return {
      id: cart.id,
      guestCartToken,
      customerId: cart.customerId,
      status: cart.status,
      expiresAt: cart.expiresAt.toISOString(),
      items,
      summary,
      coupon: appliedCoupon,
      createdAt: cart.createdAt.toISOString(),
      updatedAt: cart.updatedAt.toISOString(),
    };
  }

  /**
   * Adds product variant to cart or increments quantity if already present.
   * Validates active variant status, available inventory, and purchase limit (10).
   */
  async addItem(
    cartId: string,
    params: { variantId: string; quantity: number }
  ): Promise<CartView> {
    const quantity = Math.floor(params.quantity);
    if (quantity < 1 || quantity > CART_PURCHASE_LIMIT_PER_VARIANT) {
      throw new CartError(
        "INVALID_QUANTITY",
        `Quantity must be between 1 and ${CART_PURCHASE_LIMIT_PER_VARIANT}.`,
        400
      );
    }

    const variant = await prisma.productVariant.findUnique({
      where: { id: params.variantId },
      include: {
        product: true,
        inventory: true,
      },
    });

    if (
      !variant ||
      variant.status !== "ACTIVE" ||
      variant.product.status !== "PUBLISHED"
    ) {
      throw new CartError(
        "VARIANT_NOT_FOUND",
        "The requested product variant is not available.",
        404
      );
    }

    const onHand = variant.inventory?.onHandQuantity ?? 0;
    const reserved = variant.inventory?.reservedQuantity ?? 0;
    const availableStock = Math.max(0, onHand - reserved);

    // Check existing item
    const existingItem = await prisma.cartItem.findUnique({
      where: {
        cartId_variantId: {
          cartId,
          variantId: params.variantId,
        },
      },
    });

    const targetQuantity = existingItem
      ? existingItem.quantity + quantity
      : quantity;

    if (targetQuantity > CART_PURCHASE_LIMIT_PER_VARIANT) {
      throw new CartError(
        "PURCHASE_LIMIT_EXCEEDED",
        `Maximum ${CART_PURCHASE_LIMIT_PER_VARIANT} units allowed per variant.`,
        400
      );
    }

    if (targetQuantity > availableStock) {
      throw new CartError(
        "INSUFFICIENT_STOCK",
        `Only ${availableStock} units available in stock.`,
        409
      );
    }

    if (existingItem) {
      await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: targetQuantity },
      });
    } else {
      await prisma.cartItem.create({
        data: {
          cartId,
          variantId: params.variantId,
          quantity,
        },
      });
    }

    // Touch Cart updatedAt
    await prisma.cart.update({
      where: { id: cartId },
      data: { updatedAt: new Date() },
    });

    return this.getCart(cartId);
  }

  /**
   * Updates line item quantity. Passing quantity = 0 deletes the line item.
   */
  async updateItem(
    cartId: string,
    itemId: string,
    quantity: number
  ): Promise<CartView> {
    const targetQty = Math.floor(quantity);

    if (targetQty === 0) {
      return this.removeItem(cartId, itemId);
    }

    if (targetQty < 1 || targetQty > CART_PURCHASE_LIMIT_PER_VARIANT) {
      throw new CartError(
        "INVALID_QUANTITY",
        `Item quantity must be between 1 and ${CART_PURCHASE_LIMIT_PER_VARIANT}.`,
        400
      );
    }

    const item = await prisma.cartItem.findFirst({
      where: { id: itemId, cartId },
      include: {
        variant: {
          include: {
            inventory: true,
          },
        },
      },
    });

    if (!item) {
      throw new CartError("ITEM_NOT_FOUND", "Cart item not found.", 404);
    }

    const onHand = item.variant.inventory?.onHandQuantity ?? 0;
    const reserved = item.variant.inventory?.reservedQuantity ?? 0;
    const availableStock = Math.max(0, onHand - reserved);

    if (targetQty > availableStock) {
      throw new CartError(
        "INSUFFICIENT_STOCK",
        `Only ${availableStock} units available in stock.`,
        409
      );
    }

    await prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity: targetQty },
    });

    await prisma.cart.update({
      where: { id: cartId },
      data: { updatedAt: new Date() },
    });

    return this.getCart(cartId);
  }

  /**
   * Removes line item from cart.
   */
  async removeItem(cartId: string, itemId: string): Promise<CartView> {
    const deleteResult = await prisma.cartItem.deleteMany({
      where: { id: itemId, cartId },
    });

    if (deleteResult.count === 0) {
      throw new CartError("ITEM_NOT_FOUND", "Cart item not found.", 404);
    }

    await prisma.cart.update({
      where: { id: cartId },
      data: { updatedAt: new Date() },
    });

    return this.getCart(cartId);
  }

  /**
   * Merges guest cart into customer's authenticated cart upon login/registration.
   * Complies with PRD Section 6.5 (FR-CART-007, FR-CART-008).
   *
   * Logic:
   * - Resolves guest cart by hashToken(guestToken).
   * - Resolves customer's active cart.
   * - For each item in guest cart:
   *   - If item already in customer cart: combine quantities (capped at available inventory & 10).
   *   - If item not in customer cart: transfer up to available stock.
   * - Marks guest cart status as MERGED.
   * - Migrates applied coupon to customer cart if customer cart has no coupon.
   */
  async mergeGuestCart(
    guestToken: string,
    userId: string
  ): Promise<CartView> {
    if (!guestToken || guestToken.trim().length === 0) {
      return this.getOrCreateCart({ userId });
    }

    const guestTokenHash = hashToken(guestToken.trim());
    const guestCart = await prisma.cart.findFirst({
      where: {
        guestTokenHash,
        status: "ACTIVE",
      },
      include: {
        cartItems: {
          include: {
            variant: {
              include: {
                inventory: true,
              },
            },
          },
        },
      },
    });

    if (!guestCart || guestCart.cartItems.length === 0) {
      return this.getOrCreateCart({ userId });
    }

    const customerCartView = await this.getOrCreateCart({ userId });
    if (guestCart.id === customerCartView.id) {
      return customerCartView;
    }

    // Merge line items
    for (const gItem of guestCart.cartItems) {
      const onHand = gItem.variant.inventory?.onHandQuantity ?? 0;
      const reserved = gItem.variant.inventory?.reservedQuantity ?? 0;
      const availableStock = Math.max(0, onHand - reserved);
      if (availableStock <= 0) continue;

      const existingInCustomer = await prisma.cartItem.findUnique({
        where: {
          cartId_variantId: {
            cartId: customerCartView.id,
            variantId: gItem.variantId,
          },
        },
      });

      if (existingInCustomer) {
        const combined = Math.min(
          CART_PURCHASE_LIMIT_PER_VARIANT,
          Math.min(availableStock, existingInCustomer.quantity + gItem.quantity)
        );
        await prisma.cartItem.update({
          where: { id: existingInCustomer.id },
          data: { quantity: combined },
        });
      } else {
        const initialQty = Math.min(
          CART_PURCHASE_LIMIT_PER_VARIANT,
          Math.min(availableStock, gItem.quantity)
        );
        await prisma.cartItem.create({
          data: {
            cartId: customerCartView.id,
            variantId: gItem.variantId,
            quantity: initialQty,
          },
        });
      }
    }

    // Mark guest cart MERGED
    await prisma.cart.update({
      where: { id: guestCart.id },
      data: { status: "MERGED" },
    });

    // Transfer coupon from guest cart if present
    const guestCoupon = cartCouponRegistry.get(guestCart.id);
    if (guestCoupon && !cartCouponRegistry.has(customerCartView.id)) {
      cartCouponRegistry.set(customerCartView.id, guestCoupon);
    }
    cartCouponRegistry.delete(guestCart.id);

    return this.getCart(customerCartView.id);
  }

  /**
   * Applies promotional coupon code to active cart.
   * Validates coupon status, start/end dates, max uses, and min order threshold.
   */
  async applyCoupon(cartId: string, couponCode: string): Promise<CartView> {
    const code = couponCode.trim().toUpperCase();
    const cart = await this.getCart(cartId);

    if (cart.items.length === 0) {
      throw new CartError(
        "COUPON_INVALID",
        "Cannot apply coupon to an empty cart.",
        422
      );
    }

    const evaluation = await this.evaluateCoupon(code, cart.summary.subtotalMinor);
    if (!evaluation.valid || !evaluation.promotion) {
      throw new CartError(
        "COUPON_INVALID",
        evaluation.reason || "Invalid coupon code.",
        422
      );
    }

    cartCouponRegistry.set(cartId, evaluation.promotion.code);
    return this.getCart(cartId);
  }

  /**
   * Clears applied promotional coupon from cart.
   */
  async removeCoupon(cartId: string): Promise<CartView> {
    cartCouponRegistry.delete(cartId);
    return this.getCart(cartId);
  }

  /**
   * Authoritative coupon evaluation helper.
   */
  private async evaluateCoupon(
    code: string,
    subtotalMinor: number
  ): Promise<{
    valid: boolean;
    reason?: string;
    promotion?: {
      id: string;
      code: string;
      type: string;
      valueMinor: number;
      minOrderMinor: number;
    };
    discountMinor: number;
  }> {
    const promotion = await prisma.promotion.findUnique({
      where: { code },
    });

    if (!promotion) {
      return { valid: false, reason: "Coupon code does not exist.", discountMinor: 0 };
    }

    if (promotion.status !== "ACTIVE") {
      return { valid: false, reason: "This coupon is no longer active.", discountMinor: 0 };
    }

    const now = new Date();
    if (promotion.startsAt > now) {
      return { valid: false, reason: "This coupon has not started yet.", discountMinor: 0 };
    }

    if (promotion.endsAt && promotion.endsAt < now) {
      return { valid: false, reason: "This coupon has expired.", discountMinor: 0 };
    }

    if (promotion.maxUses !== null && promotion.usageCount >= promotion.maxUses) {
      return { valid: false, reason: "Coupon usage limit has been reached.", discountMinor: 0 };
    }

    if (subtotalMinor < promotion.minOrderMinor) {
      const minDecimal = MoneyEngine.toDecimal({
        amountMinor: promotion.minOrderMinor,
        currency: DEFAULT_CURRENCY,
      });
      return {
        valid: false,
        reason: `Coupon requires a minimum order subtotal of $${minDecimal}.`,
        discountMinor: 0,
      };
    }

    // Calculate discount in minor units
    let discountMinor = 0;
    if (promotion.type === "PERCENTAGE") {
      // valueMinor is in basis points (1000 = 10%)
      discountMinor = Math.min(
        subtotalMinor,
        Math.round((subtotalMinor * promotion.valueMinor) / 10000)
      );
    } else if (promotion.type === "FIXED_AMOUNT") {
      // valueMinor is fixed cents (e.g. 2000 = $20.00)
      discountMinor = Math.min(subtotalMinor, promotion.valueMinor);
    }

    return {
      valid: true,
      promotion: {
        id: promotion.id,
        code: promotion.code,
        type: promotion.type,
        valueMinor: promotion.valueMinor,
        minOrderMinor: promotion.minOrderMinor,
      },
      discountMinor,
    };
  }
}

export const cartService = new CartService();

/**
 * Resolves current cart from request context (Auth Session or Guest Token).
 */
export async function resolveRequestCart(
  req: NextRequest,
  explicitGuestToken?: string
): Promise<{
  cart: CartView;
  responseHeaders: Headers;
}> {
  const responseHeaders = new Headers();
  const userId = await getAuthenticatedUserId(req);

  if (userId) {
    const cart = await cartService.getOrCreateCart({ userId });
    return { cart, responseHeaders };
  }

  const guestToken =
    explicitGuestToken ||
    req.headers.get("x-guest-cart-token") ||
    req.headers.get("X-Guest-Cart-Token") ||
    req.cookies.get("guest_cart_token")?.value ||
    undefined;

  const cart = await cartService.getOrCreateCart({ guestToken });
  if (cart.guestCartToken) {
    responseHeaders.set("X-Guest-Cart-Token", cart.guestCartToken);
  }

  return { cart, responseHeaders };
}
