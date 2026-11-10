/**
 * Add Line Item to Cart Endpoint (POST /api/v1/cart/items)
 * Complies with PRD Section 6.5 and API_CONTRACT_V1.md Section 3.3.2.
 */

import { NextRequest } from "next/server";
import {
  cartService,
  resolveRequestCart,
  CartError,
} from "@/modules/cart/cart.service";
import {
  addItemSchema,
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
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError("BAD_REQUEST", "Malformed JSON body.", {
        status: 400,
        requestId,
      });
    }

    const parseResult = addItemSchema.safeParse(body);
    if (!parseResult.success) {
      return apiError(
        "VALIDATION_ERROR",
        "Invalid item data provided.",
        {
          status: 422,
          details: zodErrorsToDetails(formatZodErrors(parseResult.error)),
          requestId,
        }
      );
    }

    const { cart, responseHeaders } = await resolveRequestCart(req);
    const updatedCart = await cartService.addItem(cart.id, parseResult.data);

    return apiSuccess(updatedCart, {
      requestId,
      headers: responseHeaders,
    });
  } catch (error) {
    if (error instanceof CartError) {
      return apiError(error.code, error.message, {
        status: error.statusCode,
        requestId,
      });
    }
    logError("cart:addItem", error, { requestId });
    return apiError("INTERNAL_SERVER_ERROR", "An unexpected error occurred.", {
      status: 500,
      requestId,
    });
  }
}
