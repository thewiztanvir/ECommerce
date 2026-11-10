/**
 * Payment Processing Endpoint (POST /api/v1/payments/process)
 * Complies with PRD Section 7.3 and API_CONTRACT_V1.md Section 3.4.
 */

import { NextRequest } from "next/server";
import { paymentService, PaymentError } from "@/modules/payments/payment.service";
import { paymentProcessSchema, formatZodErrors } from "@/lib/validations/checkout.schema";
import { apiSuccess, apiError, zodErrorsToDetails } from "@/lib/api-response";
import { logError } from "@/lib/logger";

export async function POST(req: NextRequest) {
  const requestId = req.headers.get("x-request-id") || undefined;
  const idempotencyHeader =
    req.headers.get("idempotency-key") || req.headers.get("Idempotency-Key") || undefined;

  try {
    const rawBody = await req.json().catch(() => ({}));
    const parseResult = paymentProcessSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return apiError("VALIDATION_ERROR", "Invalid payment processing details.", {
        status: 400,
        requestId,
        details: zodErrorsToDetails(formatZodErrors(parseResult.error)),
      });
    }

    const { orderReference, paymentMethod, idempotencyKey: bodyKey } = parseResult.data;
    const effectiveIdempotencyKey = idempotencyHeader || bodyKey;

    const result = await paymentService.processPayment({
      orderReference,
      paymentMethod,
      idempotencyKey: effectiveIdempotencyKey,
    });

    if (!result.success) {
      const statusCode =
        result.failureCode === "CARD_DECLINED" || result.failureCode === "INSUFFICIENT_FUNDS"
          ? 402
          : 400;

      return apiError(
        result.failureCode || "PAYMENT_FAILED",
        result.failureReason || "Payment authorization failed.",
        {
          status: statusCode,
          requestId,
          details: [
            {
              field: "paymentMethod",
              code: result.failureCode || "PAYMENT_FAILED",
              message: result.failureReason || "Payment declined",
            },
          ],
        }
      );
    }

    return apiSuccess(result, {
      status: 200,
      requestId,
    });
  } catch (error: any) {
    if (error instanceof PaymentError || error?.name === "PaymentError") {
      return apiError(error.code, error.message, {
        status: error.statusCode || 400,
        requestId,
      });
    }

    logError("payments:process", error, { requestId });
    return apiError("INTERNAL_SERVER_ERROR", "An unexpected error occurred during payment processing.", {
      status: 500,
      requestId,
    });
  }
}
