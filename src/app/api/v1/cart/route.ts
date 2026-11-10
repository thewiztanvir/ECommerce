/**
 * Active Cart Resolution Endpoint (GET & POST /api/v1/cart)
 * Complies with PRD Section 6.5 and API_CONTRACT_V1.md Section 3.3.1.
 */

import { NextRequest } from "next/server";
import {
  cartService,
  resolveRequestCart,
  CartError,
} from "@/modules/cart/cart.service";
import { apiSuccess, apiError } from "@/lib/api-response";
import { logError } from "@/lib/logger";

export async function GET(req: NextRequest) {
  const requestId = req.headers.get("x-request-id") || undefined;
  try {
    const { cart, responseHeaders } = await resolveRequestCart(req);
    return apiSuccess(cart, {
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
    logError("cart:get", error, { requestId });
    return apiError("INTERNAL_SERVER_ERROR", "An unexpected error occurred.", {
      status: 500,
      requestId,
    });
  }
}

export async function POST(req: NextRequest) {
  const requestId = req.headers.get("x-request-id") || undefined;
  try {
    let explicitGuestToken: string | undefined;
    try {
      const body = await req.json();
      if (body && typeof body === "object" && "guestCartToken" in body) {
        explicitGuestToken = String(body.guestCartToken);
      }
    } catch {
      // Body is optional on POST /api/v1/cart
    }

    const { cart, responseHeaders } = await resolveRequestCart(
      req,
      explicitGuestToken
    );

    return apiSuccess(cart, {
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
    logError("cart:createOrRetrieve", error, { requestId });
    return apiError("INTERNAL_SERVER_ERROR", "An unexpected error occurred.", {
      status: 500,
      requestId,
    });
  }
}
