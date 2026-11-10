/**
 * Cart Coupon Management Endpoint (POST & DELETE /api/v1/cart/coupon)
 * Complies with PRD Section 10 and API_CONTRACT_V1.md.
 */

import { NextRequest } from "next/server";
import {
  cartService,
  resolveRequestCart,
  CartError,
} from "@/modules/cart/cart.service";
import {
  applyCouponSchema,
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

    const parseResult = applyCouponSchema.safeParse(body);
    if (!parseResult.success) {
      return apiError(
        "VALIDATION_ERROR",
        "A valid coupon code is required.",
        {
          status: 422,
          details: zodErrorsToDetails(formatZodErrors(parseResult.error)),
          requestId,
        }
      );
    }

    const { cart, responseHeaders } = await resolveRequestCart(req);
    const updatedCart = await cartService.applyCoupon(
      cart.id,
      parseResult.data.couponCode
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
    logError("cart:applyCoupon", error, { requestId });
    return apiError("INTERNAL_SERVER_ERROR", "An unexpected error occurred.", {
      status: 500,
      requestId,
    });
  }
}

export async function DELETE(req: NextRequest) {
  const requestId = req.headers.get("x-request-id") || undefined;
  try {
    const { cart, responseHeaders } = await resolveRequestCart(req);
    const updatedCart = await cartService.removeCoupon(cart.id);

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
    logError("cart:removeCoupon", error, { requestId });
    return apiError("INTERNAL_SERVER_ERROR", "An unexpected error occurred.", {
      status: 500,
      requestId,
    });
  }
}
