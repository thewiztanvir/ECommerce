/**
 * Product Detail by Slug Endpoint (GET /api/v1/products/[slug])
 * Complies with PRD Section 9.1 and API_CONTRACT_V1.md Section 3.2.2.
 */

import { NextRequest } from "next/server";
import { catalogService, CatalogError } from "@/modules/catalog/catalog.service";
import { slugSchema } from "@/lib/validations/catalog.schema";
import { apiSuccess, apiError } from "@/lib/api-response";
import { logError } from "@/lib/logger";

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export async function GET(req: NextRequest, context: RouteContext) {
  const requestId = req.headers.get("x-request-id") || undefined;
  try {
    const { slug } = await context.params;
    const parseResult = slugSchema.safeParse(slug);
    if (!parseResult.success) {
      return apiError("VALIDATION_ERROR", "Invalid product slug format.", {
        status: 422,
        requestId,
      });
    }

    const product = await catalogService.getProductBySlug(parseResult.data);
    if (!product) {
      return apiError(
        "PRODUCT_NOT_FOUND",
        `Product with slug '${parseResult.data}' not found.`,
        { status: 404, requestId }
      );
    }

    return apiSuccess(product, { requestId });
  } catch (error) {
    if (error instanceof CatalogError) {
      return apiError(error.code, error.message, {
        status: error.statusCode,
        requestId,
      });
    }
    logError("products:getBySlug", error, { requestId });
    return apiError("INTERNAL_SERVER_ERROR", "An unexpected error occurred.", {
      status: 500,
      requestId,
    });
  }
}
