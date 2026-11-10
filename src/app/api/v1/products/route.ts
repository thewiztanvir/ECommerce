/**
 * Products Listing & PLP Query Endpoint (GET /api/v1/products)
 * Complies with PRD Section 9.1 and API_CONTRACT_V1.md Section 3.2.1.
 */

import { NextRequest } from "next/server";
import { catalogService, CatalogError } from "@/modules/catalog/catalog.service";
import {
  listProductsQuerySchema,
  formatZodErrors,
} from "@/lib/validations/catalog.schema";
import {
  apiSuccess,
  apiError,
  zodErrorsToDetails,
} from "@/lib/api-response";
import { logError } from "@/lib/logger";

export async function GET(req: NextRequest) {
  const requestId = req.headers.get("x-request-id") || undefined;
  try {
    const url = new URL(req.url);
    const rawParams = Object.fromEntries(url.searchParams.entries());

    const parseResult = listProductsQuerySchema.safeParse(rawParams);
    if (!parseResult.success) {
      return apiError(
        "VALIDATION_ERROR",
        "Invalid query parameters for products listing.",
        {
          status: 422,
          details: zodErrorsToDetails(formatZodErrors(parseResult.error)),
          requestId,
        }
      );
    }

    const {
      page,
      limit,
      categorySlug,
      minPrice,
      maxPrice,
      sort,
      inStockOnly,
      q,
    } = parseResult.data;

    const brand = url.searchParams.get("brand") || undefined;

    const result = await catalogService.listProducts({
      page,
      limit,
      categorySlug,
      minPrice,
      maxPrice,
      sort,
      inStockOnly,
      q,
    });

    let filteredItems = result.items;
    if (brand) {
      filteredItems = filteredItems.filter(
        (p) => p.brandName?.toLowerCase() === brand.toLowerCase()
      );
    }

    return apiSuccess(filteredItems, {
      requestId,
      meta: {
        pagination: {
          page: result.pagination.page,
          limit: result.pagination.limit,
          total: brand ? filteredItems.length : result.pagination.total,
          totalPages: brand
            ? Math.ceil(filteredItems.length / limit) || 1
            : result.pagination.totalPages,
          hasNext: brand ? false : result.pagination.hasNext,
          hasPrev: brand ? false : result.pagination.hasPrev,
        },
        facets: result.facets,
      },
    });
  } catch (error) {
    if (error instanceof CatalogError) {
      return apiError(error.code, error.message, {
        status: error.statusCode,
        requestId,
      });
    }
    logError("products:list", error, { requestId });
    return apiError("INTERNAL_SERVER_ERROR", "An unexpected error occurred.", {
      status: 500,
      requestId,
    });
  }
}
