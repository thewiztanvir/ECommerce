/**
 * Checkout Shipping Rates Endpoint (POST /api/v1/checkout/rates)
 * Complies with PRD Section 7.2 and API_CONTRACT_V1.md Section 3.4.1.
 */

import { NextRequest } from "next/server";
import { checkoutService, CheckoutError } from "@/modules/checkout/checkout.service";
import { cartService, CartError } from "@/modules/cart/cart.service";
import { checkoutRatesSchema, formatZodErrors } from "@/lib/validations/checkout.schema";
import { apiSuccess, apiError, zodErrorsToDetails } from "@/lib/api-response";
import { logError } from "@/lib/logger";

export async function POST(req: NextRequest) {
  const requestId = req.headers.get("x-request-id") || undefined;

  try {
    const rawBody = await req.json().catch(() => ({}));
    const parseResult = checkoutRatesSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return apiError("VALIDATION_ERROR", "Invalid shipping rate calculation parameters.", {
        status: 400,
        requestId,
        details: zodErrorsToDetails(formatZodErrors(parseResult.error)),
      });
    }

    const { cartId, shippingAddress } = parseResult.data;

    // Load active cart to retrieve authoritative subtotal
    const cart = await cartService.getCart(cartId);
    const rates = checkoutService.calculateShippingRates(
      cart.summary.subtotalMinor,
      shippingAddress
    );

    return apiSuccess(rates, { requestId });
  } catch (error) {
    if (error instanceof CartError) {
      return apiError(error.code, error.message, {
        status: error.statusCode,
        requestId,
      });
    }

    if (error instanceof CheckoutError) {
      return apiError(error.code, error.message, {
        status: error.statusCode,
        requestId,
      });
    }

    logError("checkout:rates", error, { requestId });
    return apiError("INTERNAL_SERVER_ERROR", "An unexpected error occurred while calculating rates.", {
      status: 500,
      requestId,
    });
  }
}
