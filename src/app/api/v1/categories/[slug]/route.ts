/**
 * Category Detail by Slug API Endpoint (GET /api/v1/categories/[slug])
 * Complies with PRD Section 9.1 and API_CONTRACT_V1.md.
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
      return apiError("VALIDATION_ERROR", "Invalid category slug format.", {
        status: 422,
        requestId,
      });
    }

    const category = await catalogService.getCategoryBySlug(parseResult.data);
    if (!category) {
      return apiError(
        "CATEGORY_NOT_FOUND",
        `Category with slug '${parseResult.data}' not found.`,
        { status: 404, requestId }
      );
    }

    return apiSuccess(category, { requestId });
  } catch (error) {
    if (error instanceof CatalogError) {
      return apiError(error.code, error.message, {
        status: error.statusCode,
        requestId,
      });
    }
    logError("categories:getBySlug", error, { requestId });
    return apiError("INTERNAL_SERVER_ERROR", "An unexpected error occurred.", {
      status: 500,
      requestId,
    });
  }
}
