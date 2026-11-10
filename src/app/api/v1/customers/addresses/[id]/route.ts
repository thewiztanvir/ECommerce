/**
 * Customer Specific Address Endpoint (GET, PATCH, DELETE /api/v1/customers/addresses/[id])
 * Complies with PRD Section 6.6 (FR-ACCOUNT-005), Section 18.2 (Anti-IDOR), and API_CONTRACT_V1.md.
 */

import { NextRequest } from "next/server";
import {
  customersService,
  CustomerError,
} from "../../../../../../modules/customers/customers.service";
import { getAuthenticatedUserId } from "../../../../../../modules/auth/session.service";
import {
  updateAddressSchema,
  formatZodErrors,
} from "../../../../../../lib/validations/auth.schema";
import {
  apiSuccess,
  apiError,
  zodErrorsToDetails,
} from "../../../../../../lib/api-response";
import { logError } from "../../../../../../lib/logger";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, context: RouteContext) {
  const requestId = req.headers.get("x-request-id") || undefined;
  try {
    const userId = await getAuthenticatedUserId(req);
    if (!userId) {
      return apiError("UNAUTHORIZED", "Authentication required.", { status: 401, requestId });
    }

    const { id } = await context.params;
    const address = await customersService.getAddress(userId, id);
    return apiSuccess(address, { requestId });
  } catch (error) {
    if (error instanceof CustomerError) {
      return apiError(error.code, error.message, { status: error.statusCode, requestId });
    }
    logError("customers:getAddress", error, { requestId });
    return apiError("INTERNAL_SERVER_ERROR", "An unexpected error occurred.", {
      status: 500,
      requestId,
    });
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const requestId = req.headers.get("x-request-id") || undefined;
  try {
    const userId = await getAuthenticatedUserId(req);
    if (!userId) {
      return apiError("UNAUTHORIZED", "Authentication required.", { status: 401, requestId });
    }

    const { id } = await context.params;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError("BAD_REQUEST", "Malformed JSON body.", { status: 400, requestId });
    }

    const parseResult = updateAddressSchema.safeParse(body);
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

    const updated = await customersService.updateAddress(userId, id, parseResult.data);
    return apiSuccess(updated, { requestId });
  } catch (error) {
    if (error instanceof CustomerError) {
      return apiError(error.code, error.message, { status: error.statusCode, requestId });
    }
    logError("customers:updateAddress", error, { requestId });
    return apiError("INTERNAL_SERVER_ERROR", "An unexpected error occurred.", {
      status: 500,
      requestId,
    });
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  const requestId = req.headers.get("x-request-id") || undefined;
  try {
    const userId = await getAuthenticatedUserId(req);
    if (!userId) {
      return apiError("UNAUTHORIZED", "Authentication required.", { status: 401, requestId });
    }

    const { id } = await context.params;
    await customersService.deleteAddress(userId, id);
    return apiSuccess({ message: "Address deleted successfully." }, { requestId });
  } catch (error) {
    if (error instanceof CustomerError) {
      return apiError(error.code, error.message, { status: error.statusCode, requestId });
    }
    logError("customers:deleteAddress", error, { requestId });
    return apiError("INTERNAL_SERVER_ERROR", "An unexpected error occurred.", {
      status: 500,
      requestId,
    });
  }
}
