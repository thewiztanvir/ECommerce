/**
 * Current Authenticated User Endpoint (GET /api/v1/auth/me)
 * Complies with PRD Section 6.6 and ADR-005.
 */

import { NextRequest } from "next/server";
import { getAuthenticatedUser } from "../../../../../modules/auth/session.service";
import { apiSuccess, apiError } from "../../../../../lib/api-response";
import { logError } from "../../../../../lib/logger";

export async function GET(req: NextRequest) {
  const requestId = req.headers.get("x-request-id") || undefined;
  try {
    const user = await getAuthenticatedUser(req);

    if (!user) {
      return apiError("UNAUTHORIZED", "Authentication required.", { status: 401, requestId });
    }

    return apiSuccess({ user }, { requestId });
  } catch (error) {
    logError("auth:me", error, { requestId });
    return apiError("INTERNAL_SERVER_ERROR", "An unexpected error occurred.", {
      status: 500,
      requestId,
    });
  }
}
