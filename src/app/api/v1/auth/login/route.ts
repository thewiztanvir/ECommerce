/**
 * User Login Endpoint (POST /api/v1/auth/login)
 * Complies with PRD Section 6.6 (FR-ACCOUNT-002) and API_CONTRACT_V1.md.
 */

import { NextRequest } from "next/server";
import { authService, AuthError } from "../../../../../modules/auth/auth.service";
import {
  loginSchema,
  formatZodErrors,
} from "../../../../../lib/validations/auth.schema";
import {
  apiSuccess,
  apiError,
  zodErrorsToDetails,
} from "../../../../../lib/api-response";
import { createCurrentSession } from "../../../../../modules/auth/session.service";
import { cartService } from "../../../../../modules/cart/cart.service";
import { logError } from "../../../../../lib/logger";

export async function POST(req: NextRequest) {
  const requestId = req.headers.get("x-request-id") || undefined;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("BAD_REQUEST", "Malformed JSON body.", { status: 400, requestId });
  }

  const parseResult = loginSchema.safeParse(body);
  if (!parseResult.success) {
    return apiError(
      "VALIDATION_ERROR",
      "Please provide a valid email and password.",
      {
        status: 422,
        details: zodErrorsToDetails(formatZodErrors(parseResult.error)),
        requestId,
      }
    );
  }

  const { email, password } = parseResult.data;

  try {
    const user = await authService.login(email, password);

    // Establish encrypted HttpOnly session cookie without type assertions
    await createCurrentSession({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roles: user.roles,
    });

    // Check for guest cart merging (FR-CART-007, FR-CART-008)
    const guestCartToken =
      req.headers.get("x-guest-cart-token") ||
      req.headers.get("X-Guest-Cart-Token") ||
      (body && typeof body === "object" && "guestCartToken" in body
        ? String((body as Record<string, unknown>).guestCartToken)
        : undefined);

    let cartMerged = false;
    if (guestCartToken) {
      try {
        await cartService.mergeGuestCart(guestCartToken, user.id);
        cartMerged = true;
      } catch (err) {
        logError("auth:login:mergeCart", err, { requestId });
      }
    }

    return apiSuccess({ user, cartMerged }, { requestId });
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(error.code, error.message, { status: error.statusCode, requestId });
    }
    logError("auth:login", error, { requestId });
    return apiError("INTERNAL_SERVER_ERROR", "An unexpected error occurred.", {
      status: 500,
      requestId,
    });
  }
}
