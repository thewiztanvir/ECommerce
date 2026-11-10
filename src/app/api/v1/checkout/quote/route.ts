/**
 * Checkout Quote Endpoint (POST /api/v1/checkout/quote)
 * Complies with API_CONTRACT_V1.md Section 3.4.1.
 */

import { NextRequest } from "next/server";
import { checkoutService, CheckoutError } from "@/modules/checkout/checkout.service";
import { cartService, CartError } from "@/modules/cart/cart.service";
import { checkoutRatesSchema, formatZodErrors } from "@/lib/validations/checkout.schema";
import { apiSuccess, apiError, zodErrorsToDetails } from "@/lib/api-response";
import { logError } from "@/lib/logger";
import { nanoid } from "nanoid";

export async function POST(req: NextRequest) {
  const requestId = req.headers.get("x-request-id") || undefined;

  try {
    const rawBody = await req.json().catch(() => ({}));
    const parseResult = checkoutRatesSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return apiError("VALIDATION_ERROR", "Invalid quote calculation parameters.", {
        status: 400,
        requestId,
        details: zodErrorsToDetails(formatZodErrors(parseResult.error)),
      });
    }

    const { cartId, shippingAddress } = parseResult.data;
    const cart = await cartService.getCart(cartId);

    const rates = checkoutService.calculateShippingRates(
      cart.summary.subtotalMinor,
      shippingAddress
    );

    const standardRate = rates.find((r) => r.id === "standard") || rates[0];
    const shippingMinor = standardRate ? standardRate.amountMinor : 0;
    const subtotalMinor = cart.summary.subtotalMinor;
    const discountMinor = cart.summary.discountMinor;
    const taxableBase = Math.max(0, subtotalMinor - discountMinor);
    const taxMinor = checkoutService.calculateTax(taxableBase, shippingAddress?.state);
    const totalMinor = taxableBase + shippingMinor + taxMinor;

    const quote = {
      quoteId: `qte_${nanoid(16)}`,
      currency: "USD",
      subtotalMinor,
      discountMinor,
      shippingMinor,
      taxMinor,
      totalMinor,
      availableShippingMethods: rates,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    };

    return apiSuccess(quote, { requestId });
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

    logError("checkout:quote", error, { requestId });
    return apiError("INTERNAL_SERVER_ERROR", "An unexpected error occurred while calculating quote.", {
      status: 500,
      requestId,
    });
  }
}
