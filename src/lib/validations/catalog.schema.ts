/**
 * Catalog & Storefront Input Validation Schemas (Zod)
 * Complies with PRD Section 9.1, Section 17.3, and API_CONTRACT_V1.md.
 *
 * Rules:
 * - Deterministic coercions for HTTP query parameters (strings to integers/booleans).
 * - Upper limits on pagination to prevent denial-of-service (max limit: 100).
 * - Strict slug sanitization.
 */

import { z } from "zod";

export const sortOptionsEnum = z.enum([
  "featured",
  "price_asc",
  "price_desc",
  "newest",
]);

export type SortOption = z.infer<typeof sortOptionsEnum>;

/**
 * Schema for GET /api/v1/products query parameters
 */
export const listProductsQuerySchema = z.object({
  page: z
    .union([z.string(), z.number()])
    .optional()
    .transform((val) => {
      if (val === undefined || val === null || val === "") return 1;
      const num = Number(val);
      return isNaN(num) || num < 1 ? 1 : Math.floor(num);
    }),
  limit: z
    .union([z.string(), z.number()])
    .optional()
    .transform((val) => {
      if (val === undefined || val === null || val === "") return 20;
      const num = Number(val);
      if (isNaN(num) || num < 1) return 20;
      return Math.min(100, Math.floor(num));
    }),
  category: z.string().trim().min(1).optional(),
  categorySlug: z.string().trim().min(1).optional(),
  q: z.string().trim().max(200).optional(),
  minPrice: z
    .union([z.string(), z.number()])
    .optional()
    .transform((val) => {
      if (val === undefined || val === null || val === "") return undefined;
      const num = Number(val);
      return isNaN(num) || num < 0 ? undefined : Math.floor(num);
    }),
  maxPrice: z
    .union([z.string(), z.number()])
    .optional()
    .transform((val) => {
      if (val === undefined || val === null || val === "") return undefined;
      const num = Number(val);
      return isNaN(num) || num < 0 ? undefined : Math.floor(num);
    }),
  sort: sortOptionsEnum.optional().default("featured"),
  sortBy: sortOptionsEnum.optional(),
  inStockOnly: z
    .union([z.string(), z.boolean()])
    .optional()
    .transform((val) => {
      if (typeof val === "boolean") return val;
      if (typeof val === "string") {
        const lower = val.toLowerCase().trim();
        return lower === "true" || lower === "1" || lower === "yes";
      }
      return false;
    }),
}).transform((data) => {
  // Normalize category / categorySlug
  const resolvedCategory = data.categorySlug || data.category;
  // Normalize sort / sortBy
  const resolvedSort = data.sortBy || data.sort || "featured";
  return {
    ...data,
    categorySlug: resolvedCategory,
    sort: resolvedSort,
  };
});

export type ListProductsQueryInput = z.infer<typeof listProductsQuerySchema>;

/**
 * Schema for GET /api/v1/search query parameters
 */
export const searchProductsQuerySchema = z.object({
  q: z
    .string({ required_error: "Search query 'q' parameter is required." })
    .trim()
    .min(1, "Search query must not be empty.")
    .max(200, "Search query must not exceed 200 characters."),
  page: z
    .union([z.string(), z.number()])
    .optional()
    .transform((val) => {
      if (val === undefined || val === null || val === "") return 1;
      const num = Number(val);
      return isNaN(num) || num < 1 ? 1 : Math.floor(num);
    }),
  limit: z
    .union([z.string(), z.number()])
    .optional()
    .transform((val) => {
      if (val === undefined || val === null || val === "") return 20;
      const num = Number(val);
      if (isNaN(num) || num < 1) return 20;
      return Math.min(100, Math.floor(num));
    }),
});

export type SearchProductsQueryInput = z.infer<typeof searchProductsQuerySchema>;

/**
 * Validates a category or product URL slug
 */
export const slugSchema = z
  .string()
  .trim()
  .min(1, "Slug must not be empty.")
  .max(150, "Slug must not exceed 150 characters.")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Slug must be lowercase alphanumeric characters separated by single hyphens."
  );

export { formatZodErrors } from "./auth.schema";
