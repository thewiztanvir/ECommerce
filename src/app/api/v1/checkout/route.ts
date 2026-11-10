/**
 * Checkout Pipeline Endpoint (POST /api/v1/checkout)
 * Complies with PRD Section 7, Section 17.1, 17.4 and API_CONTRACT_V1.md Section 3.4.2.
 */

import { NextRequest } from "next/server";
import { checkoutService, CheckoutError } from "@/modules/checkout/checkout.service";
import { getAuthenticatedUser } from "@/modules/auth/session.service";
import { createOrderSchema, formatZodErrors } from "@/lib/validations/checkout.schema";
import { apiSuccess, apiError, zodErrorsToDetails } from "@/lib/api-response";
import { logError } from "@/lib/logger";

export async function POST(req: NextRequest) {
  const requestId = req.headers.get("x-request-id") || undefined;
  const idempotencyHeader =
    req.headers.get("idempotency-key") || req.headers.get("Idempotency-Key") || undefined;

  try {
    const rawBody = await req.json().catch(() => ({}));
    const parseResult = createOrderSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return apiError("VALIDATION_ERROR", "Invalid checkout submission payload.", {
        status: 400,
        requestId,
        details: zodErrorsToDetails(formatZodErrors(parseResult.error)),
      });
    }

    const { cartId, guestEmail, shippingAddress, billingAddress, shippingMethodId, idempotencyKey: bodyKey } =
      parseResult.data;

    const user = await getAuthenticatedUser(req);
    const effectiveIdempotencyKey = idempotencyHeader || bodyKey;

    const order = await checkoutService.createOrderFromCart({
      cartId,
      guestEmail: user ? undefined : guestEmail,
      customerId: user ? user.id : undefined,
      shippingAddress,
      billingAddress,
      shippingMethodId,
      idempotencyKey: effectiveIdempotencyKey,
    });

    return apiSuccess(order, {
      status: 201,
      requestId,
    });
  } catch (error) {
    if (error instanceof CheckoutError) {
      return apiError(error.code, error.message, {
        status: error.statusCode,
        requestId,
      });
    }

    logError("checkout:submit", error, { requestId });
    return apiError("INTERNAL_SERVER_ERROR", "An unexpected error occurred during checkout.", {
      status: 500,
      requestId,
    });
  }
}
