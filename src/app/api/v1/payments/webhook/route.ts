/**
 * Payment Webhook Endpoint (POST /api/v1/payments/webhook)
 * Complies with PRD Section 7.3, Section 17.5 and API_CONTRACT_V1.md Section 3.5.
 */

import { NextRequest, NextResponse } from "next/server";
import { paymentService, PaymentError } from "@/modules/payments/payment.service";
import { logError } from "@/lib/logger";

export async function POST(req: NextRequest) {
  const requestId = req.headers.get("x-request-id") || undefined;
  const signature =
    req.headers.get("stripe-signature") ||
    req.headers.get("x-mock-signature") ||
    req.headers.get("mock-signature") ||
    undefined;

  try {
    const rawBody = await req.text();

    if (!rawBody) {
      return NextResponse.json(
        {
          error: {
            code: "BAD_REQUEST",
            message: "Missing raw webhook payload body.",
          },
        },
        { status: 400 }
      );
    }

    let parsedPayload: Record<string, unknown> = {};
    try {
      parsedPayload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        {
          error: {
            code: "MALFORMED_JSON",
            message: "Failed to parse webhook JSON payload.",
          },
        },
        { status: 400 }
      );
    }

    const eventId = String(parsedPayload.id || parsedPayload.eventId || `evt_${Date.now()}`);
    const eventType = String(parsedPayload.type || parsedPayload.eventType || "unknown");
    const provider = String(parsedPayload.provider || "mock");

    const result = await paymentService.handleWebhook({
      eventId,
      eventType,
      provider,
      orderReference: (parsedPayload.orderReference as string) || undefined,
      transactionId: (parsedPayload.transactionId as string) || undefined,
      amountMinor: typeof parsedPayload.amountMinor === "number" ? parsedPayload.amountMinor : undefined,
      status: parsedPayload.status === "FAILED" ? "FAILED" : "SUCCEEDED",
      payload: parsedPayload,
      rawBody,
      signature,
    });

    return NextResponse.json(
      {
        received: true,
        duplicate: result.duplicate,
        eventId: result.eventId,
        processed: result.processed ?? true,
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof PaymentError) {
      return NextResponse.json(
        {
          error: {
            code: error.code,
            message: error.message,
            details: error.details,
          },
        },
        { status: error.statusCode }
      );
    }

    logError("payments:webhook", error, { requestId });
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Internal error processing payment webhook.",
        },
      },
      { status: 500 }
    );
  }
}
