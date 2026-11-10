/**
 * Standard REST API Response Utilities & Envelopes
 * Complies with PRD Section 17.2, Section 18.2 & API_CONTRACT_V1.md.
 *
 * All API routes MUST use these helpers to ensure uniform response shapes,
 * request ID tracking, and standardized error codes.
 */

import { NextResponse } from "next/server";
import { nanoid } from "nanoid";

export interface ApiPaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface ApiMeta {
  request_id: string;
  timestamp: string;
  pagination?: ApiPaginationMeta;
  [key: string]: unknown;
}

export interface ApiSuccessEnvelope<T> {
  data: T;
  meta: ApiMeta;
}

export interface ApiErrorDetail {
  field?: string;
  code?: string;
  message: string;
}

export interface ApiErrorEnvelope {
  error: {
    code: string;
    message: string;
    details?: ApiErrorDetail[];
    request_id: string;
    timestamp: string;
  };
}

/**
 * Creates a unique Request ID for tracing.
 */
export function generateRequestId(): string {
  return `req_${nanoid(20)}`;
}

/**
 * Resolves request ID from request headers or generates a new tracing identifier.
 */
export function getRequestId(req?: Request | Headers): string {
  if (!req) return generateRequestId();
  const headers = req instanceof Request ? req.headers : req;
  const existing = headers.get("x-request-id") || headers.get("X-Request-ID");
  return existing?.trim() || generateRequestId();
}

/**
 * Returns a standardized 2xx Success JSON response.
 */
export function apiSuccess<T>(
  data: T,
  options?: {
    status?: number;
    meta?: Record<string, unknown>;
    requestId?: string;
    headers?: HeadersInit;
  }
): NextResponse<ApiSuccessEnvelope<T>> {
  const status = options?.status ?? 200;
  const requestId = options?.requestId ?? generateRequestId();
  const timestamp = new Date().toISOString();

  const responseBody: ApiSuccessEnvelope<T> = {
    data,
    meta: {
      request_id: requestId,
      timestamp,
      ...(options?.meta ?? {}),
    },
  };

  const headers = new Headers(options?.headers);
  headers.set("X-Request-ID", requestId);
  headers.set("Content-Type", "application/json; charset=utf-8");

  return NextResponse.json(responseBody, {
    status,
    headers,
  });
}

/**
 * Returns a standardized 4xx or 5xx Error JSON response.
 */
export function apiError(
  code: string,
  message: string,
  options?: {
    status?: number;
    details?: ApiErrorDetail[];
    requestId?: string;
    headers?: HeadersInit;
  }
): NextResponse<ApiErrorEnvelope> {
  const status = options?.status ?? 400;
  const requestId = options?.requestId ?? generateRequestId();
  const timestamp = new Date().toISOString();

  const responseBody: ApiErrorEnvelope = {
    error: {
      code,
      message,
      ...(options?.details && options.details.length > 0
        ? { details: options.details }
        : {}),
      request_id: requestId,
      timestamp,
    },
  };

  const headers = new Headers(options?.headers);
  headers.set("X-Request-ID", requestId);
  headers.set("Content-Type", "application/json; charset=utf-8");

  return NextResponse.json(responseBody, {
    status,
    headers,
  });
}

/**
 * Formats Zod validation issues into ApiErrorDetail array.
 */
export function zodErrorsToDetails(
  errors: Record<string, string[]>
): ApiErrorDetail[] {
  const details: ApiErrorDetail[] = [];
  for (const [field, messages] of Object.entries(errors)) {
    for (const msg of messages) {
      details.push({
        field,
        code: "INVALID_FIELD",
        message: msg,
      });
    }
  }
  return details;
}
