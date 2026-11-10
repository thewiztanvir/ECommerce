/**
 * Checkout & Order State Machine Domain Service
 * Complies with PRD Section 7, Section 8, Section 17.3, and API_CONTRACT_V1.md Section 3.4.
 *
 * Responsibilities:
 * 1. Shipping rate evaluation (Standard, Express, Overnight) and free shipping thresholds.
 * 2. Authoritative sales tax calculation in integer minor units.
 * 3. Atomic order creation with ZERO-overselling conditional inventory reservations (ADR-002).
 * 4. Strictly enforced client Idempotency-Key handling (PRD Section 17.1, 17.4).
 * 5. Immutable snapshots of catalog items, prices, and shipping/billing addresses.
 * 6. Non-sequential public order references (ORD-YYYY-XXXXXXXX) via Crockford alphabet.
 *
 * Rules:
 * - ZERO binary floating-point math; use integer minor units (cents).
 * - Enforce transactional atomicity.
 * - Zero `any` types.
 */

import { prisma, type Prisma } from "../../lib/db";
import { atomicReserveInventory } from "../../lib/db";
import { generateOrderReference, generateIdempotencyKey } from "../../lib/identifiers";
import { cartService, type CartView } from "../cart/cart.service";
import type { AddressInput } from "../../lib/validations/checkout.schema";

// =============================================================================
// Constants & Configuration
// =============================================================================

export const FREE_SHIPPING_THRESHOLD_MINOR = 7500; // $75.00
export const STANDARD_SHIPPING_FEE_MINOR = 750;    // $7.50
export const EXPRESS_SHIPPING_FEE_MINOR = 1500;    // $15.00
export const OVERNIGHT_SHIPPING_FEE_MINOR = 2500;  // $25.00
export const DEFAULT_TAX_BPS = 850;                // 8.5% in basis points
export const RESERVATION_TTL_MINUTES = 15;

// =============================================================================
// Domain Error & Type Definitions
// =============================================================================

export class CheckoutError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 400,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "CheckoutError";
  }
}

export interface ShippingRateOption {
  id: "standard" | "express" | "overnight";
  name: string;
  description: string;
  amountMinor: number;
  estimatedDays: string;
}

export interface CreateOrderParams {
  cartId: string;
  guestEmail?: string;
  customerId?: string;
  shippingAddress: AddressInput;
  billingAddress?: AddressInput;
  shippingMethodId: "standard" | "express" | "overnight";
  idempotencyKey?: string;
}

export interface OrderItemSnapshot {
  id: string;
  variantId: string;
  sku: string;
  productTitle: string;
  variantTitle: string;
  unitPriceMinor: number;
  quantity: number;
  totalMinor: number;
  snapshotJson: string;
}

export interface OrderAddressSnapshot {
  id: string;
  type: string;
  recipientName: string;
  streetLine1: string;
  streetLine2: string | null;
  city: string;
  state: string;
  postalCode: string;
  countryCode: string;
}

export interface OrderStatusHistoryItem {
  id: string;
  fromStatus: string;
  toStatus: string;
  source: string;
  reason: string | null;
  createdAt: string;
}

export interface OrderDetailView {
  id: string;
  publicReference: string;
  customerId: string | null;
  guestEmail: string | null;
  status: string;
  currency: string;
  subtotalMinor: number;
  discountMinor: number;
  shippingMinor: number;
  taxMinor: number;
  totalMinor: number;
  idempotencyKey: string | null;
  orderItems: OrderItemSnapshot[];
  orderAddresses: OrderAddressSnapshot[];
  statusHistory: OrderStatusHistoryItem[];
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// Checkout Service Class
// =============================================================================

export class CheckoutService {
  /**
   * Calculates available shipping methods and fees based on subtotal.
   * Free standard shipping applies on orders over $75.00.
   */
  calculateShippingRates(
    subtotalMinor: number,
    _destination?: AddressInput
  ): ShippingRateOption[] {
    const isFreeStandard = subtotalMinor >= FREE_SHIPPING_THRESHOLD_MINOR;

    return [
      {
        id: "standard",
        name: "Standard Ground Delivery",
        description: isFreeStandard
          ? "Free on orders over $75 (3-5 business days)"
          : "Tracked ground transit (3-5 business days)",
        amountMinor: isFreeStandard ? 0 : STANDARD_SHIPPING_FEE_MINOR,
        estimatedDays: "3-5",
      },
      {
        id: "express",
        name: "Express Priority Air",
        description: "Expedited 2-day domestic air shipping",
        amountMinor: EXPRESS_SHIPPING_FEE_MINOR,
        estimatedDays: "2",
      },
      {
        id: "overnight",
        name: "Overnight Delivery",
        description: "Next business day priority dispatch",
        amountMinor: OVERNIGHT_SHIPPING_FEE_MINOR,
        estimatedDays: "1",
      },
    ];
  }

  /**
   * Calculates estimated sales tax in minor units.
   */
  calculateTax(taxableBaseMinor: number, _state?: string): number {
    if (taxableBaseMinor <= 0) return 0;
    return Math.round((taxableBaseMinor * DEFAULT_TAX_BPS) / 10000);
  }

  /**
   * Atomically converts an active shopping cart into an Order.
   * Enforces client Idempotency-Key, performs atomic inventory reservations,
   * generates public reference (ORD-YYYY-XXXXXXXX), and records address/item snapshots.
   */
  async createOrderFromCart(params: CreateOrderParams): Promise<OrderDetailView> {
    const idempotencyKey = params.idempotencyKey || generateIdempotencyKey();

    // 1. Idempotency Check: Replay existing order if idempotency key already processed
    const existingOrder = await prisma.order.findUnique({
      where: { idempotencyKey },
      include: {
        orderItems: true,
        orderAddresses: true,
        statusHistory: { orderBy: { createdAt: "asc" } },
      },
    });

    if (existingOrder) {
      return this.formatOrderView(existingOrder);
    }

    // 2. Validate Cart State
    let cart: CartView;
    try {
      cart = await cartService.getCart(params.cartId);
    } catch {
      throw new CheckoutError(
        "INVALID_CART",
        "The specified cart does not exist or has expired.",
        400
      );
    }

    if (cart.items.length === 0) {
      throw new CheckoutError(
        "EMPTY_CART",
        "Cannot create order from an empty cart.",
        400
      );
    }

    const effectiveCustomerId = params.customerId || cart.customerId || null;
    const effectiveGuestEmail = effectiveCustomerId
      ? null
      : params.guestEmail || null;

    if (!effectiveCustomerId && !effectiveGuestEmail) {
      throw new CheckoutError(
        "EMAIL_REQUIRED",
        "Guest email address is required for order confirmation.",
        422
      );
    }

    // 3. Resolve Shipping Fee
    const rates = this.calculateShippingRates(
      cart.summary.subtotalMinor,
      params.shippingAddress
    );
    const selectedRate = rates.find((r) => r.id === params.shippingMethodId);
    if (!selectedRate) {
      throw new CheckoutError(
        "INVALID_SHIPPING_METHOD",
        `Unknown shipping method: ${params.shippingMethodId}`,
        400
      );
    }

    const shippingMinor = selectedRate.amountMinor;
    const subtotalMinor = cart.summary.subtotalMinor;
    const discountMinor = cart.summary.discountMinor;
    const taxableBase = Math.max(0, subtotalMinor - discountMinor);
    const taxMinor = this.calculateTax(taxableBase, params.shippingAddress.state);
    const totalMinor = taxableBase + shippingMinor + taxMinor;

    const publicReference = generateOrderReference();
    const reservationExpiresAt = new Date(
      Date.now() + RESERVATION_TTL_MINUTES * 60 * 1000
    );

    // 4. Atomic Execution in Prisma Transaction
    const createdOrder = await prisma.$transaction(async (tx) => {
      // Step A: Atomic Inventory Reservation for all line items
      for (const item of cart.items) {
        const reserved = await atomicReserveInventory(
          tx,
          item.variantId,
          item.quantity
        );

        if (!reserved) {
          throw new CheckoutError(
            "INSUFFICIENT_STOCK",
            `Insufficient available stock for '${item.title}'. Please review your cart.`,
            409
          );
        }

        // Record active reservation linked to this cart
        await tx.inventoryReservation.create({
          data: {
            cartId: cart.id,
            variantId: item.variantId,
            quantity: item.quantity,
            expiresAt: reservationExpiresAt,
            status: "ACTIVE",
          },
        });
      }

      // Step B: Create Order Record
      const order = await tx.order.create({
        data: {
          publicReference,
          customerId: effectiveCustomerId,
          guestEmail: effectiveGuestEmail,
          status: "PENDING_PAYMENT",
          currency: "USD",
          subtotalMinor,
          discountMinor,
          shippingMinor,
          taxMinor,
          totalMinor,
          idempotencyKey,
        },
      });

      // Link reservations to order
      await tx.inventoryReservation.updateMany({
        where: { cartId: cart.id, status: "ACTIVE" },
        data: { orderId: order.id },
      });

      // Step C: Create OrderItem Snapshots
      for (const item of cart.items) {
        await tx.orderItem.create({
          data: {
            orderId: order.id,
            variantId: item.variantId,
            sku: item.sku,
            productTitle: item.productTitle,
            variantTitle: item.variantTitle,
            unitPriceMinor: item.unitPriceMinor,
            quantity: item.quantity,
            totalMinor: item.totalMinor,
            snapshotJson: JSON.stringify({
              productSlug: item.productSlug,
              thumbnailUrl: item.thumbnailUrl,
            }),
          },
        });
      }

      // Step D: Create Shipping & Billing Address Snapshots
      const billing = params.billingAddress || params.shippingAddress;

      await tx.orderAddress.createMany({
        data: [
          {
            orderId: order.id,
            type: "SHIPPING",
            recipientName: params.shippingAddress.recipientName,
            streetLine1: params.shippingAddress.streetLine1,
            streetLine2: params.shippingAddress.streetLine2 || null,
            city: params.shippingAddress.city,
            state: params.shippingAddress.state,
            postalCode: params.shippingAddress.postalCode,
            countryCode: params.shippingAddress.countryCode,
          },
          {
            orderId: order.id,
            type: "BILLING",
            recipientName: billing.recipientName,
            streetLine1: billing.streetLine1,
            streetLine2: billing.streetLine2 || null,
            city: billing.city,
            state: billing.state,
            postalCode: billing.postalCode,
            countryCode: billing.countryCode,
          },
        ],
      });

      // Step E: Initial OrderStatusHistory entry
      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: "NONE",
          toStatus: "PENDING_PAYMENT",
          source: "SYSTEM",
          reason: "Order created via checkout pipeline",
        },
      });

      // Step F: Mark Cart as CONVERTED
      await tx.cart.update({
        where: { id: cart.id },
        data: { status: "CONVERTED" },
      });

      // Retrieve full created aggregate
      return tx.order.findUniqueOrThrow({
        where: { id: order.id },
        include: {
          orderItems: true,
          orderAddresses: true,
          statusHistory: { orderBy: { createdAt: "asc" } },
        },
      });
    });

    return this.formatOrderView(createdOrder);
  }

  /**
   * Retrieves an Order by its public reference or internal ID.
   * Enforces customer authorization if userId is provided.
   */
  async getOrderByReference(
    reference: string,
    userId?: string
  ): Promise<OrderDetailView | null> {
    const order = await prisma.order.findFirst({
      where: {
        OR: [{ publicReference: reference }, { id: reference }],
      },
      include: {
        orderItems: true,
        orderAddresses: true,
        statusHistory: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!order) {
      return null;
    }

    if (userId && order.customerId && order.customerId !== userId) {
      throw new CheckoutError(
        "FORBIDDEN",
        "You do not have permission to view this order.",
        403
      );
    }

    return this.formatOrderView(order);
  }

  /**
   * Formats database aggregate into standard OrderDetailView.
   */
  private formatOrderView(
    order: Prisma.OrderGetPayload<{
      include: {
        orderItems: true;
        orderAddresses: true;
        statusHistory: true;
      };
    }>
  ): OrderDetailView {
    return {
      id: order.id,
      publicReference: order.publicReference,
      customerId: order.customerId,
      guestEmail: order.guestEmail,
      status: order.status,
      currency: order.currency,
      subtotalMinor: order.subtotalMinor,
      discountMinor: order.discountMinor,
      shippingMinor: order.shippingMinor,
      taxMinor: order.taxMinor,
      totalMinor: order.totalMinor,
      idempotencyKey: order.idempotencyKey,
      orderItems: order.orderItems.map((item) => ({
        id: item.id,
        variantId: item.variantId,
        sku: item.sku,
        productTitle: item.productTitle,
        variantTitle: item.variantTitle,
        unitPriceMinor: item.unitPriceMinor,
        quantity: item.quantity,
        totalMinor: item.totalMinor,
        snapshotJson: item.snapshotJson,
      })),
      orderAddresses: order.orderAddresses.map((addr) => ({
        id: addr.id,
        type: addr.type,
        recipientName: addr.recipientName,
        streetLine1: addr.streetLine1,
        streetLine2: addr.streetLine2,
        city: addr.city,
        state: addr.state,
        postalCode: addr.postalCode,
        countryCode: addr.countryCode,
      })),
      statusHistory: order.statusHistory.map((h) => ({
        id: h.id,
        fromStatus: h.fromStatus,
        toStatus: h.toStatus,
        source: h.source,
        reason: h.reason,
        createdAt: h.createdAt.toISOString(),
      })),
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
    };
  }
}

export const checkoutService = new CheckoutService();
