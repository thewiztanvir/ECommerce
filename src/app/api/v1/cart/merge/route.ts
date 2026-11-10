/**
 * Cart Merging Endpoint (POST /api/v1/cart/merge)
 * Complies with PRD Section 6.5 (FR-CART-007, FR-CART-008) and API_CONTRACT_V1.md.
 */

import { NextRequest } from "next/server";
import { cartService, CartError } from "@/modules/cart/cart.service";
import { getAuthenticatedUserId } from "@/modules/auth/session.service";
import {
  mergeCartSchema,
  formatZodErrors,
} from "@/lib/validations/cart.schema";
import {
  apiSuccess,
  apiError,
  zodErrorsToDetails,
} from "@/lib/api-response";
import { logError } from "@/lib/logger";

export async function POST(req: NextRequest) {
  const requestId = req.headers.get("x-request-id") || undefined;
  try {
    const userId = await getAuthenticatedUserId(req);
    if (!userId) {
      return apiError(
        "UNAUTHORIZED",
        "Authentication required to merge shopping cart.",
        { status: 401, requestId }
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError("BAD_REQUEST", "Malformed JSON body.", {
        status: 400,
        requestId,
      });
    }

    const parseResult = mergeCartSchema.safeParse(body);
    if (!parseResult.success) {
      return apiError(
        "VALIDATION_ERROR",
        "Valid guestCartToken is required for cart merging.",
        {
          status: 422,
          details: zodErrorsToDetails(formatZodErrors(parseResult.error)),
          requestId,
        }
      );
    }

    const mergedCart = await cartService.mergeGuestCart(
      parseResult.data.guestCartToken,
      userId
    );

    return apiSuccess(mergedCart, { requestId });
  } catch (error) {
    if (error instanceof CartError) {
      return apiError(error.code, error.message, {
        status: error.statusCode,
        requestId,
      });
    }
    logError("cart:merge", error, { requestId });
    return apiError("INTERNAL_SERVER_ERROR", "An unexpected error occurred.", {
      status: 500,
      requestId,
    });
  }
}
