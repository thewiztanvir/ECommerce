/**
 * Forgot Password Endpoint (POST /api/v1/auth/password/forgot)
 * Complies with PRD Section 6.6 (FR-ACCOUNT-003) and OWASP Anti-Enumeration Guidelines.
 */

import { NextRequest } from "next/server";
import { authService, AuthError } from "../../../../../../modules/auth/auth.service";
import {
  forgotPasswordSchema,
  formatZodErrors,
} from "../../../../../../lib/validations/auth.schema";
import {
  apiSuccess,
  apiError,
  zodErrorsToDetails,
} from "../../../../../../lib/api-response";
import { logError } from "../../../../../../lib/logger";

export async function POST(req: NextRequest) {
  const requestId = req.headers.get("x-request-id") || undefined;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("BAD_REQUEST", "Malformed JSON body.", { status: 400, requestId });
  }

  const parseResult = forgotPasswordSchema.safeParse(body);
  if (!parseResult.success) {
    return apiError(
      "VALIDATION_ERROR",
      "Please provide a valid email address.",
      {
        status: 422,
        details: zodErrorsToDetails(formatZodErrors(parseResult.error)),
        requestId,
      }
    );
  }

  try {
    const result = await authService.requestPasswordReset(parseResult.data.email);
    return apiSuccess(result, { requestId });
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(error.code, error.message, { status: error.statusCode, requestId });
    }
    logError("auth:password:forgot", error, { requestId });
    return apiError("INTERNAL_SERVER_ERROR", "An unexpected error occurred.", {
      status: 500,
      requestId,
    });
  }
}
