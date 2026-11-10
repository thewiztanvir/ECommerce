/**
 * Cart & Promotions Validation Schemas (Zod)
 * Complies with PRD Section 6.5, Section 10, Section 17.3, and API_CONTRACT_V1.md Section 3.3.
 */

import { z } from "zod";
import { formatZodErrors } from "./auth.schema";

export { formatZodErrors };

/**
 * Add line item request body schema
 */
export const addItemSchema = z.object({
  variantId: z
    .string({ required_error: "variantId is required" })
    .trim()
    .min(1, "variantId must not be empty"),
  quantity: z
    .number()
    .int("quantity must be an integer")
    .min(1, "quantity must be at least 1")
    .max(10, "quantity cannot exceed purchase limit of 10")
    .default(1),
});

export type AddItemInput = z.infer<typeof addItemSchema>;

/**
 * Update line item quantity request body schema
 */
export const updateItemSchema = z.object({
  quantity: z
    .number({ required_error: "quantity is required" })
    .int("quantity must be an integer")
    .min(0, "quantity cannot be negative")
    .max(10, "quantity cannot exceed purchase limit of 10"),
});

export type UpdateItemInput = z.infer<typeof updateItemSchema>;

/**
 * Apply coupon request body schema
 * Supports both `couponCode` and `code` for API compatibility.
 */
export const applyCouponSchema = z
  .object({
    couponCode: z.string().trim().max(50).optional(),
    code: z.string().trim().max(50).optional(),
  })
  .refine((data) => Boolean(data.couponCode || data.code), {
    message: "A coupon code is required.",
  })
  .transform((data) => ({
    couponCode: (data.couponCode || data.code)!.trim().toUpperCase(),
  }));

export type ApplyCouponInput = z.infer<typeof applyCouponSchema>;

/**
 * Merge guest cart request body schema
 */
export const mergeCartSchema = z.object({
  guestCartToken: z
    .string({ required_error: "guestCartToken is required" })
    .trim()
    .min(1, "guestCartToken must not be empty"),
});

export type MergeCartInput = z.infer<typeof mergeCartSchema>;
