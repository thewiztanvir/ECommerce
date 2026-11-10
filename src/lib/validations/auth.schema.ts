import { z } from "zod";

/**
 * Authentication & Address Validation Schemas
 * Complies with PRD Section 6.6 (FR-ACCOUNT-001, FR-ACCOUNT-002, FR-ACCOUNT-003, FR-ACCOUNT-005),
 * Section 7.1 (FR-CHECKOUT-002, FR-CHECKOUT-003), Section 18.1, and ADR-005.
 */

// =============================================================================
// Reusable Primitives
// =============================================================================

/**
 * Robust email schema:
 * - Trims whitespace
 * - Converts to lowercase for normalized DB indexing
 * - Enforces valid email pattern and maximum length 255
 */
export const emailSchema = z
  .string({ required_error: "Email is required" })
  .trim()
  .toLowerCase()
  .min(1, "Email cannot be empty")
  .max(255, "Email cannot exceed 255 characters")
  .email("Invalid email address format");

/**
 * Password policy schema:
 * - Minimum 8 characters (OWASP / NIST baseline)
 * - Maximum 72 characters (prevents bcrypt 72-byte truncation attack & CPU exhaustion DoS)
 * - Requires at least 1 uppercase letter
 * - Requires at least 1 lowercase letter
 * - Requires at least 1 number
 * - Requires at least 1 special character
 */
export const passwordSchema = z
  .string({ required_error: "Password is required" })
  .min(8, "Password must be at least 8 characters long")
  .max(72, "Password cannot exceed 72 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character");

/**
 * Relaxed password schema for login (only verifies presence and max length,
 * never blocks authentication due to policy evolution)
 */
export const loginPasswordSchema = z
  .string({ required_error: "Password is required" })
  .min(1, "Password cannot be empty")
  .max(128, "Password cannot exceed 128 characters");

/**
 * E.164 compatible telephone validation schema
 */
export const phoneSchema = z
  .string()
  .trim()
  .regex(
    /^\+?[1-9]\d{6,14}$/,
    "Invalid phone number. Use international format (e.g. +12125550123)"
  );

// =============================================================================
// 1. User Registration Schemas
// =============================================================================

/**
 * Registration schema with password confirmation (typically used by client signup forms)
 */
export const registerSchema = z
  .object({
    firstName: z
      .string({ required_error: "First name is required" })
      .trim()
      .min(1, "First name cannot be empty")
      .max(100, "First name cannot exceed 100 characters"),
    lastName: z
      .string({ required_error: "Last name is required" })
      .trim()
      .min(1, "Last name cannot be empty")
      .max(100, "Last name cannot exceed 100 characters"),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z
      .string({ required_error: "Password confirmation is required" })
      .min(1, "Please confirm your password"),
    phone: phoneSchema.optional().or(z.literal("")).nullable(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

/**
 * API payload schema for backend registration handler
 */
export const registerPayloadSchema = z.object({
  firstName: z
    .string({ required_error: "First name is required" })
    .trim()
    .min(1, "First name cannot be empty")
    .max(100, "First name cannot exceed 100 characters"),
  lastName: z
    .string({ required_error: "Last name is required" })
    .trim()
    .min(1, "Last name cannot be empty")
    .max(100, "Last name cannot exceed 100 characters"),
  email: emailSchema,
  password: passwordSchema,
  phone: phoneSchema.optional().or(z.literal("")).nullable(),
});

// =============================================================================
// 2. User Login Schema
// =============================================================================

export const loginSchema = z.object({
  email: emailSchema,
  password: loginPasswordSchema,
  rememberMe: z.boolean().default(false),
});

// =============================================================================
// 3. Password Reset Schemas
// =============================================================================

/**
 * Forgot password / reset request schema (FR-ACCOUNT-003)
 */
export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

/**
 * Confirm password reset schema with token
 */
export const resetPasswordSchema = z
  .object({
    token: z
      .string({ required_error: "Reset token is required" })
      .trim()
      .min(1, "Reset token cannot be empty"),
    password: passwordSchema,
    confirmPassword: z
      .string({ required_error: "Password confirmation is required" })
      .min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

/**
 * Authenticated user password update schema
 */
export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string({ required_error: "Current password is required" })
      .min(1, "Current password cannot be empty"),
    newPassword: passwordSchema,
    confirmNewPassword: z
      .string({ required_error: "Password confirmation is required" })
      .min(1, "Please confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "New passwords do not match",
    path: ["confirmNewPassword"],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "New password must be different from current password",
    path: ["newPassword"],
  });

// =============================================================================
// 4. Address Schemas (FR-ACCOUNT-005, FR-CHECKOUT-002/003)
// =============================================================================

export const AddressTypeEnum = z.enum(["SHIPPING", "BILLING"]);
export type AddressType = z.infer<typeof AddressTypeEnum>;

export const createAddressSchema = z.object({
  recipientName: z
    .string({ required_error: "Recipient name is required" })
    .trim()
    .min(2, "Recipient name must be at least 2 characters")
    .max(100, "Recipient name cannot exceed 100 characters"),
  type: AddressTypeEnum.default("SHIPPING"),
  streetLine1: z
    .string({ required_error: "Street address is required" })
    .trim()
    .min(3, "Street address must be at least 3 characters")
    .max(255, "Street address cannot exceed 255 characters"),
  streetLine2: z
    .string()
    .trim()
    .max(255, "Apartment/Suite cannot exceed 255 characters")
    .optional()
    .or(z.literal(""))
    .nullable(),
  city: z
    .string({ required_error: "City is required" })
    .trim()
    .min(2, "City must be at least 2 characters")
    .max(100, "City cannot exceed 100 characters"),
  state: z
    .string({ required_error: "State / Province is required" })
    .trim()
    .min(2, "State or province must be at least 2 characters")
    .max(100, "State or province cannot exceed 100 characters"),
  postalCode: z
    .string({ required_error: "Postal code is required" })
    .trim()
    .min(2, "Postal code must be at least 2 characters")
    .max(20, "Postal code cannot exceed 20 characters")
    .regex(/^[A-Za-z0-9\s\-]+$/, "Postal code contains invalid characters"),
  countryCode: z
    .string({ required_error: "Country code is required" })
    .trim()
    .toUpperCase()
    .length(2, "Country code must be a 2-letter ISO 3166-1 alpha-2 code (e.g. US)")
    .default("US"),
  phone: phoneSchema.optional().or(z.literal("")).nullable(),
  isDefault: z.boolean().default(false),
});

export const updateAddressSchema = createAddressSchema.partial();

// =============================================================================
// Inferred TypeScript Types
// =============================================================================

export type RegisterInput = z.infer<typeof registerSchema>;
export type RegisterPayloadInput = z.infer<typeof registerPayloadSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type CreateAddressInput = z.infer<typeof createAddressSchema>;
export type UpdateAddressInput = z.infer<typeof updateAddressSchema>;

// =============================================================================
// Validation Helpers (Safe Parse wrappers)
// =============================================================================

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; errors: Record<string, string[]> };

export function formatZodErrors(error: z.ZodError): Record<string, string[]> {
  const formatted: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_global";
    if (!formatted[key]) {
      formatted[key] = [];
    }
    formatted[key].push(issue.message);
  }
  return formatted;
}

export function validateSchema<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): ValidationResult<T> {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: formatZodErrors(result.error) };
}
