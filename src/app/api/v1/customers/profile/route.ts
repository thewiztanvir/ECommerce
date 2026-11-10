/**
 * Customer Profile Endpoint (GET & PATCH /api/v1/customers/profile)
 * Complies with PRD Section 6.6 (FR-ACCOUNT-004, FR-ACCOUNT-005) and ADR-005.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import {
  customersService,
  CustomerError,
} from "../../../../../modules/customers/customers.service";
import { getAuthenticatedUserId } from "../../../../../modules/auth/session.service";
import {
  phoneSchema,
  formatZodErrors,
} from "../../../../../lib/validations/auth.schema";
import {
  apiSuccess,
  apiError,
  zodErrorsToDetails,
} from "../../../../../lib/api-response";
import { logError } from "../../../../../lib/logger";

const updateProfileSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, "First name cannot be empty")
    .max(100, "First name cannot exceed 100 characters")
    .optional(),
  lastName: z
    .string()
    .trim()
    .min(1, "Last name cannot be empty")
    .max(100, "Last name cannot exceed 100 characters")
    .optional(),
  phone: phoneSchema.optional().or(z.literal("")).nullable(),
});

export async function GET(req: NextRequest) {
  const requestId = req.headers.get("x-request-id") || undefined;
  try {
    const userId = await getAuthenticatedUserId(req);
    if (!userId) {
      return apiError("UNAUTHORIZED", "Authentication required.", { status: 401, requestId });
    }

    const profile = await customersService.getProfile(userId);
    return apiSuccess(profile, { requestId });
  } catch (error) {
    if (error instanceof CustomerError) {
      return apiError(error.code, error.message, { status: error.statusCode, requestId });
    }
    logError("customers:getProfile", error, { requestId });
    return apiError("INTERNAL_SERVER_ERROR", "An unexpected error occurred.", {
      status: 500,
      requestId,
    });
  }
}

export async function PATCH(req: NextRequest) {
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

    const parseResult = updateProfileSchema.safeParse(body);
    if (!parseResult.success) {
      return apiError(
        "VALIDATION_ERROR",
        "Please review the submitted profile details.",
        {
          status: 422,
          details: zodErrorsToDetails(formatZodErrors(parseResult.error)),
          requestId,
        }
      );
    }

    const updated = await customersService.updateProfile(userId, parseResult.data);
    return apiSuccess(updated, { requestId });
  } catch (error) {
    if (error instanceof CustomerError) {
      return apiError(error.code, error.message, { status: error.statusCode, requestId });
    }
    logError("customers:updateProfile", error, { requestId });
    return apiError("INTERNAL_SERVER_ERROR", "An unexpected error occurred.", {
      status: 500,
      requestId,
    });
  }
}
