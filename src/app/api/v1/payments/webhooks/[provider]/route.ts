/**
 * Durable Payment Webhook Receiver (POST /api/v1/payments/webhooks/[provider])
 * Complies with PRD Section 7.3, Section 17.5, and API_CONTRACT_V1.md Section 3.5.
 */

import { NextRequest } from "next/server";
import { paymentService } from "@/modules/payment/payment.service";
import { apiSuccess, apiError } from "@/lib/api-response";
import { logError } from "@/lib/logger";

interface RouteContext {
  params: Promise<{ provider: string }>;
}

export async function POST(req: NextRequest, context: RouteContext) {
  const requestId = req.headers.get("x-request-id") || undefined;
  try {
    const { provider } = await context.params;
    let body: any;
    try {
      body = await req.json();
    } catch {
      return apiError("BAD_REQUEST", "Malformed JSON webhook body.", {
        status: 400,
        requestId,
      });
    }

    const eventId =
      body.eventId ||
      body.id ||
      req.headers.get("x-event-id") ||
      `evt_${Date.now()}`;
    const eventType = body.eventType || body.type || "payment.received";
    const status =
      body.status === "SUCCEEDED" || body.type === "payment_intent.succeeded"
        ? "SUCCEEDED"
        : body.status === "FAILED"
        ? "FAILED"
        : undefined;
    const orderReference =
      body.orderReference ||
      body.data?.object?.metadata?.orderReference ||
      undefined;

    const result = await paymentService.handleWebhook({
      provider: provider || "mock",
      eventId,
      eventType,
      orderReference,
      status,
      payload: body,
    });

    return apiSuccess(result, { requestId });
  } catch (error) {
    logError("payments:webhook", error, { requestId });
    return apiError("INTERNAL_SERVER_ERROR", "Failed to process webhook event.", {
      status: 500,
      requestId,
    });
  }
}
