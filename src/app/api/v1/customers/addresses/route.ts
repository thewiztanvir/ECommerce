/**
 * Customer Addresses Collection Endpoint (GET & POST /api/v1/customers/addresses)
 * Complies with PRD Section 6.6 (FR-ACCOUNT-005), Section 18.2 (Anti-IDOR), and API_CONTRACT_V1.md.
 */

import { NextRequest } from "next/server";
import {
  customersService,
  CustomerError,
} from "../../../../../modules/customers/customers.service";
import { getAuthenticatedUserId } from "../../../../../modules/auth/session.service";
import {
  createAddressSchema,
  formatZodErrors,
} from "../../../../../lib/validations/auth.schema";
import {
  apiSuccess,
  apiError,
  zodErrorsToDetails,
} from "../../../../../lib/api-response";
import { logError } from "../../../../../lib/logger";

export async function GET(req: NextRequest) {
  const requestId = req.headers.get("x-request-id") || undefined;
  try {
    const userId = await getAuthenticatedUserId(req);
    if (!userId) {
      return apiError("UNAUTHORIZED", "Authentication required.", { status: 401, requestId });
    }

    const addresses = await customersService.listAddresses(userId);
    return apiSuccess({ addresses }, { requestId });
  } catch (error) {
    if (error instanceof CustomerError) {
      return apiError(error.code, error.message, { status: error.statusCode, requestId });
    }
    logError("customers:listAddresses", error, { requestId });
    return apiError("INTERNAL_SERVER_ERROR", "An unexpected error occurred.", {
      status: 500,
      requestId,
    });
  }
}

export async function POST(req: NextRequest) {
  const requestId = req.headers.get("x-request-id") || undefined;
  try {
    const userId = await getAuthenticatedUserId(req);
    if (!userId) {
      return apiError("UNAUTHORIZED", "Authentication required.", { status: 401, requestId });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError("BAD_REQUEST", "Malformed JSON body.", { status: 400, requestId });
    }

    const parseResult = createAddressSchema.safeParse(body);
    if (!parseResult.success) {
      return apiError(
        "VALIDATION_ERROR",
        "Please review the submitted address details.",
        {
          status: 422,
          details: zodErrorsToDetails(formatZodErrors(parseResult.error)),
          requestId,
        }
      );
    }

    const address = await customersService.createAddress(userId, parseResult.data);
    return apiSuccess(address, { status: 201, requestId });
  } catch (error) {
    if (error instanceof CustomerError) {
      return apiError(error.code, error.message, { status: error.statusCode, requestId });
    }
    logError("customers:createAddress", error, { requestId });
    return apiError("INTERNAL_SERVER_ERROR", "An unexpected error occurred.", {
      status: 500,
      requestId,
    });
  }
}
