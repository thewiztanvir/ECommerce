/**
 * User Registration Endpoint (POST /api/v1/auth/register)
 * Complies with PRD Section 6.6 (FR-ACCOUNT-001) and API_CONTRACT_V1.md.
 */

import { NextRequest } from "next/server";
import { authService, AuthError } from "../../../../../modules/auth/auth.service";
import {
  registerSchema,
  registerPayloadSchema,
  formatZodErrors,
} from "../../../../../lib/validations/auth.schema";
import {
  apiSuccess,
  apiError,
  zodErrorsToDetails,
} from "../../../../../lib/api-response";
import { createCurrentSession } from "../../../../../modules/auth/session.service";
import { logError } from "../../../../../lib/logger";

export async function POST(req: NextRequest) {
  const requestId = req.headers.get("x-request-id") || undefined;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("BAD_REQUEST", "Malformed JSON body.", { status: 400, requestId });
  }

  // Validate with registerPayloadSchema (or registerSchema if confirmPassword is provided)
  const isFormSchema = body && typeof body === "object" && "confirmPassword" in body;
  const parseResult = isFormSchema
    ? registerSchema.safeParse(body)
    : registerPayloadSchema.safeParse(body);

  if (!parseResult.success) {
    return apiError(
      "VALIDATION_ERROR",
      "Please review the submitted registration details.",
      {
        status: 422,
        details: zodErrorsToDetails(formatZodErrors(parseResult.error)),
        requestId,
      }
    );
  }

  const { email, password, firstName, lastName, phone } = parseResult.data;

  try {
    const user = await authService.register({
      email,
      password,
      firstName,
      lastName,
      phone: phone || null,
    });

    // Establish authenticated session without type assertions
    await createCurrentSession({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roles: user.roles,
    });

    return apiSuccess({ user }, { status: 201, requestId });
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(error.code, error.message, { status: error.statusCode, requestId });
    }
    logError("auth:register", error, { requestId });
    return apiError("INTERNAL_SERVER_ERROR", "An unexpected error occurred.", {
      status: 500,
      requestId,
    });
  }
}
