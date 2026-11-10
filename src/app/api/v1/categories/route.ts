/**
 * Categories Hierarchy API Endpoint (GET /api/v1/categories)
 * Complies with PRD Section 9.1 and API_CONTRACT_V1.md Section 3.2.3.
 */

import { NextRequest } from "next/server";
import { catalogService, CatalogError } from "@/modules/catalog/catalog.service";
import { apiSuccess, apiError } from "@/lib/api-response";
import { logError } from "@/lib/logger";

export async function GET(req: NextRequest) {
  const requestId = req.headers.get("x-request-id") || undefined;
  try {
    const categories = await catalogService.listCategories();
    return apiSuccess(categories, { requestId });
  } catch (error) {
    if (error instanceof CatalogError) {
      return apiError(error.code, error.message, {
        status: error.statusCode,
        requestId,
      });
    }
    logError("categories:list", error, { requestId });
    return apiError("INTERNAL_SERVER_ERROR", "An unexpected error occurred.", {
      status: 500,
      requestId,
    });
  }
}
