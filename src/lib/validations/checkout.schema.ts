/**
 * Checkout & Order Placement Validation Schemas
 * Complies with PRD Section 7, Section 17.4, and ADR-005.
 */

import { z } from "zod";
import { emailSchema, phoneSchema, formatZodErrors } from "./auth.schema";

export { formatZodErrors };

export const shippingMethodSchema = z.enum(["STANDARD", "EXPRESS", "OVERNIGHT"]);
export type ShippingMethod = z.infer<typeof shippingMethodSchema>;

export const SHIPPING_RATES: Record<
  ShippingMethod,
  { name: string; estimate: string; basePriceMinor: number }
> = {
  STANDARD: {
    name: "Standard Ground",
    estimate: "3-5 business days",
    basePriceMinor: 750, // $7.50 (Free if subtotal >= $75.00)
  },
  EXPRESS: {
    name: "Express 2-Day",
    estimate: "2 business days",
    basePriceMinor: 1500, // $15.00
  },
  OVERNIGHT: {
    name: "Next-Day Priority",
    estimate: "Next business day morning",
    basePriceMinor: 2500, // $25.00
  },
};

export const checkoutAddressSchema = z.object({
  recipientName: z
    .string()
    .trim()
    .min(2, "Full recipient name must be at least 2 characters")
    .max(100, "Recipient name cannot exceed 100 characters"),
  streetLine1: z
    .string()
    .trim()
    .min(3, "Street address must be at least 3 characters")
    .max(150, "Street address cannot exceed 150 characters"),
  streetLine2: z.string().trim().max(100).optional().nullable(),
  city: z
    .string()
    .trim()
    .min(2, "City must be at least 2 characters")
    .max(100, "City cannot exceed 100 characters"),
  state: z
    .string()
    .trim()
    .min(2, "State/Province must be at least 2 characters")
    .max(50, "State cannot exceed 50 characters"),
  postalCode: z
    .string()
    .trim()
    .min(3, "Postal code must be at least 3 characters")
    .max(20, "Postal code cannot exceed 20 characters"),
  countryCode: z.string().trim().length(2, "Country code must be ISO 2-letter").default("US"),
});

export const checkoutCustomerSchema = z.object({
  email: emailSchema,
  firstName: z
    .string()
    .trim()
    .min(1, "First name is required")
    .max(50, "First name cannot exceed 50 characters"),
  lastName: z
    .string()
    .trim()
    .min(1, "Last name is required")
    .max(50, "Last name cannot exceed 50 characters"),
  phone: z
    .string()
    .trim()
    .transform((val) => val.replace(/[\s\-\(\)\.]/g, ""))
    .refine((val) => val === "" || /^\+?[1-9]\d{6,14}$/.test(val), {
      message: "Invalid phone number format",
    })
    .optional()
    .or(z.literal("")),
});

export const checkoutPaymentSchema = z.object({
  cardNumber: z
    .string()
    .trim()
    .transform((val) => val.replace(/\s+/g, ""))
    .refine((val) => /^\d{15,16}$/.test(val), "Card number must be 15 or 16 digits"),
  cardholderName: z
    .string()
    .trim()
    .min(2, "Cardholder name is required")
    .max(100, "Cardholder name cannot exceed 100 characters"),
  expiry: z
    .string()
    .trim()
    .regex(/^(0[1-9]|1[0-2])\/?([2-9][0-9])$/, "Expiry must be in MM/YY format"),
  cvc: z
    .string()
    .trim()
    .regex(/^\d{3,4}$/, "CVC must be 3 or 4 digits"),
});

export const checkoutItemSchema = z.object({
  variantId: z.string().min(1, "Variant ID is required"),
  quantity: z.number().int().min(1, "Quantity must be at least 1").max(10, "Max 10 per variant"),
  productSlug: z.string().optional(),
  title: z.string().optional(),
  variantTitle: z.string().optional(),
  unitPriceMinor: z.number().int().nonnegative().optional(),
  thumbnailUrl: z.string().nullable().optional(),
});

export const placeOrderSchema = z.object({
  customer: checkoutCustomerSchema,
  shippingAddress: checkoutAddressSchema,
  shippingMethod: shippingMethodSchema.default("STANDARD"),
  payment: checkoutPaymentSchema,
  items: z.array(checkoutItemSchema).min(1, "Order must contain at least one line item"),
  couponCode: z.string().trim().max(30).optional().nullable(),
  idempotencyKey: z
    .string()
    .trim()
    .min(8, "Idempotency key must be at least 8 characters")
    .max(100, "Idempotency key cannot exceed 100 characters")
    .optional(),
});

export type PlaceOrderInput = z.infer<typeof placeOrderSchema>;
export type CheckoutAddressInput = z.infer<typeof checkoutAddressSchema>;
export type CheckoutCustomerInput = z.infer<typeof checkoutCustomerSchema>;
export type CheckoutPaymentInput = z.infer<typeof checkoutPaymentSchema>;

export const addressSchema = checkoutAddressSchema;
export type AddressInput = CheckoutAddressInput;

export const checkoutRatesSchema = z.object({
  cartId: z.string().trim().min(1, "cartId is required"),
  shippingAddress: checkoutAddressSchema.optional(),
});
export type CheckoutRatesInput = z.infer<typeof checkoutRatesSchema>;

export const createOrderSchema = z.object({
  cartId: z.string().trim().min(1, "cartId is required"),
  guestEmail: z.string().trim().email().optional(),
  shippingAddress: checkoutAddressSchema,
  billingAddress: checkoutAddressSchema.optional(),
  shippingMethodId: z
    .enum(["standard", "express", "overnight", "STANDARD", "EXPRESS", "OVERNIGHT"])
    .default("standard")
    .transform((val) => val.toLowerCase() as "standard" | "express" | "overnight"),
  idempotencyKey: z.string().trim().min(8).optional(),
});
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const paymentProcessSchema = z.object({
  orderReference: z.string().trim().min(1, "orderReference is required"),
  paymentMethod: z.object({
    type: z.enum(["card", "mock"]).default("card"),
    cardNumber: z
      .string()
      .trim()
      .min(12, "Card number must be at least 12 digits")
      .max(19, "Card number cannot exceed 19 digits")
      .transform((val) => val.replace(/[\s-]/g, "")),
    expMonth: z.number().int().min(1).max(12),
    expYear: z.number().int().min(2024).max(2050),
    cvc: z.string().trim().min(3).max(4),
  }),
  idempotencyKey: z.string().trim().min(8).optional(),
});
export type PaymentProcessInput = z.infer<typeof paymentProcessSchema>;

export const paymentWebhookSchema = z.object({
  eventId: z.string().trim().min(1, "eventId is required"),
  eventType: z.string().default("payment_intent.succeeded"),
  provider: z.string().default("mock"),
  orderReference: z.string().optional(),
  transactionId: z.string().optional(),
  amountMinor: z.number().int().optional(),
  status: z.enum(["SUCCEEDED", "FAILED"]).default("SUCCEEDED"),
  payload: z.record(z.unknown()).optional(),
});
export type PaymentWebhookInput = z.infer<typeof paymentWebhookSchema>;
