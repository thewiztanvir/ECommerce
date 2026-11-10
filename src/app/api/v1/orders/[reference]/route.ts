/**
 * Order Detail Endpoint (GET /api/v1/orders/[reference])
 * Complies with PRD Section 8.1 and API_CONTRACT_V1.md Section 3.4.
 */

import { NextRequest } from "next/server";
import { checkoutService, CheckoutError } from "@/modules/checkout/checkout.service";
import { getAuthenticatedUserId } from "@/modules/auth/session.service";
import { apiSuccess, apiError } from "@/lib/api-response";
import { logError } from "@/lib/logger";

interface RouteContext {
  params: Promise<{ reference: string }>;
}

export async function GET(req: NextRequest, context: RouteContext) {
  const requestId = req.headers.get("x-request-id") || undefined;

  try {
    const { reference } = await context.params;

    if (!reference || reference.trim().length === 0) {
      return apiError("VALIDATION_ERROR", "Order reference is required.", {
        status: 400,
        requestId,
      });
    }

    const userId = await getAuthenticatedUserId(req);
    const order = await checkoutService.getOrderByReference(
      reference.trim(),
      userId || undefined
    );

    if (!order) {
      return apiError(
        "ORDER_NOT_FOUND",
        `Order '${reference}' was not found.`,
        { status: 404, requestId }
      );
    }

    return apiSuccess(order, { requestId });
  } catch (error) {
    if (error instanceof CheckoutError) {
      return apiError(error.code, error.message, {
        status: error.statusCode,
        requestId,
      });
    }

    logError("orders:getByReference", error, { requestId });
    return apiError("INTERNAL_SERVER_ERROR", "An unexpected error occurred while retrieving order.", {
      status: 500,
      requestId,
    });
  }
}
