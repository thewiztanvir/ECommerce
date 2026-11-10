/**
 * Cart Line Item Manipulation Endpoint (PATCH & DELETE /api/v1/cart/items/[id])
 * Complies with PRD Section 6.5 and API_CONTRACT_V1.md Section 3.3.3 & 3.3.4.
 */

import { NextRequest } from "next/server";
import {
  cartService,
  resolveRequestCart,
  CartError,
} from "@/modules/cart/cart.service";
import {
  updateItemSchema,
  formatZodErrors,
} from "@/lib/validations/cart.schema";
import {
  apiSuccess,
  apiError,
  zodErrorsToDetails,
} from "@/lib/api-response";
import { logError } from "@/lib/logger";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const requestId = req.headers.get("x-request-id") || undefined;
  try {
    const { id } = await context.params;
    if (!id || id.trim().length === 0) {
      return apiError("VALIDATION_ERROR", "Item ID parameter is required.", {
        status: 422,
        requestId,
      });
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

    const parseResult = updateItemSchema.safeParse(body);
    if (!parseResult.success) {
      return apiError(
        "VALIDATION_ERROR",
        "Invalid quantity parameter provided.",
        {
          status: 422,
          details: zodErrorsToDetails(formatZodErrors(parseResult.error)),
          requestId,
        }
      );
    }

    const { cart, responseHeaders } = await resolveRequestCart(req);
    const updatedCart = await cartService.updateItem(
      cart.id,
      id,
      parseResult.data.quantity
    );

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
    logError("cart:updateItem", error, { requestId });
    return apiError("INTERNAL_SERVER_ERROR", "An unexpected error occurred.", {
      status: 500,
      requestId,
    });
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  const requestId = req.headers.get("x-request-id") || undefined;
  try {
    const { id } = await context.params;
    if (!id || id.trim().length === 0) {
      return apiError("VALIDATION_ERROR", "Item ID parameter is required.", {
        status: 422,
        requestId,
      });
    }

    const { cart, responseHeaders } = await resolveRequestCart(req);
    const updatedCart = await cartService.removeItem(cart.id, id);

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
    logError("cart:removeItem", error, { requestId });
    return apiError("INTERNAL_SERVER_ERROR", "An unexpected error occurred.", {
      status: 500,
      requestId,
    });
  }
}
