/**
 * User Logout Endpoint (POST /api/v1/auth/logout)
 * Complies with PRD Section 6.6 (FR-ACCOUNT-002) and ADR-005.
 */

import { NextRequest } from "next/server";
import { destroyCurrentSession } from "../../../../../modules/auth/session.service";
import { apiSuccess, apiError } from "../../../../../lib/api-response";
import { logError } from "../../../../../lib/logger";

export async function POST(req: NextRequest) {
  const requestId = req.headers.get("x-request-id") || undefined;
  try {
    await destroyCurrentSession();

    return apiSuccess({ message: "Successfully logged out." }, { requestId });
  } catch (error) {
    logError("auth:logout", error, { requestId });
    return apiError("INTERNAL_SERVER_ERROR", "An unexpected error occurred during logout.", {
      status: 500,
      requestId,
    });
  }
}
