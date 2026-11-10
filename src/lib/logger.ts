/**
 * Centralized Structured Logger with PII & Secret Redaction
 * Complies with PRD Section 18.2 (Rule 7: Structured Logging) and ADR-005.
 *
 * Requirements:
 * 1. Outputs structured JSON log entries.
 * 2. Strictly redacts sensitive fields: passwords, hashes, tokens, auth headers, payment card data.
 * 3. Binds correlation request IDs for end-to-end distributed tracing.
 */

export type LogLevel = "info" | "warn" | "error" | "debug";

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  context: string;
  message: string;
  requestId?: string;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  metadata?: Record<string, unknown>;
}

const SENSITIVE_KEY_PATTERNS = [
  /passw(or)?d/i,
  /secret/i,
  /token/i,
  /auth(orization)?/i,
  /cookie/i,
  /credit[-_]?card/i,
  /pan/i,
  /cvv/i,
  /cvc/i,
  /ssn/i,
  /hash/i,
];

/**
 * Deeply sanitizes and redacts sensitive properties from metadata objects.
 */
export function redactSensitiveData(data: unknown, depth: number = 0): unknown {
  if (depth > 5 || data === null || data === undefined) {
    return data;
  }

  if (typeof data === "string") {
    // Redact bearer tokens if present in plain string
    if (data.toLowerCase().startsWith("bearer ")) {
      return "Bearer [REDACTED]";
    }
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => redactSensitiveData(item, depth + 1));
  }

  if (typeof data === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      const isSensitiveKey = SENSITIVE_KEY_PATTERNS.some((pattern) =>
        pattern.test(key)
      );

      if (isSensitiveKey) {
        sanitized[key] = "[REDACTED]";
      } else {
        sanitized[key] = redactSensitiveData(value, depth + 1);
      }
    }
    return sanitized;
  }

  return data;
}

function writeLog(entry: LogEntry): void {
  const json = JSON.stringify(entry);
  if (entry.level === "error") {
    process.stderr.write(`${json}\n`);
  } else {
    process.stdout.write(`${json}\n`);
  }
}

/**
 * Logs a structured error with redaction and request ID correlation.
 */
export function logError(
  context: string,
  error: unknown,
  options?: {
    requestId?: string;
    message?: string;
    metadata?: Record<string, unknown>;
  }
): void {
  const isErrorInstance = error instanceof Error;
  const isProduction = process.env.NODE_ENV === "production";

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level: "error",
    context,
    message: options?.message || (isErrorInstance ? error.message : String(error)),
    ...(options?.requestId ? { requestId: options.requestId } : {}),
    error: isErrorInstance
      ? {
          name: error.name,
          message: error.message,
          ...(!isProduction && error.stack ? { stack: error.stack } : {}),
        }
      : {
          name: "NonErrorThrown",
          message: String(error),
        },
    ...(options?.metadata
      ? { metadata: redactSensitiveData(options.metadata) as Record<string, unknown> }
      : {}),
  };

  writeLog(entry);
}

/**
 * Logs a structured warning.
 */
export function logWarn(
  context: string,
  message: string,
  options?: {
    requestId?: string;
    metadata?: Record<string, unknown>;
  }
): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level: "warn",
    context,
    message,
    ...(options?.requestId ? { requestId: options.requestId } : {}),
    ...(options?.metadata
      ? { metadata: redactSensitiveData(options.metadata) as Record<string, unknown> }
      : {}),
  };

  writeLog(entry);
}

/**
 * Logs a structured informational message.
 */
export function logInfo(
  context: string,
  message: string,
  options?: {
    requestId?: string;
    metadata?: Record<string, unknown>;
  }
): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level: "info",
    context,
    message,
    ...(options?.requestId ? { requestId: options.requestId } : {}),
    ...(options?.metadata
      ? { metadata: redactSensitiveData(options.metadata) as Record<string, unknown> }
      : {}),
  };

  writeLog(entry);
}
