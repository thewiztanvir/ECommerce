/**
 * NanoID-Based Public Reference & Token Generator
 * Complies with PRD Section 8.1 (FR-ORDER-002, FR-ORDER-003) and ADR-001 / ADR-005.
 *
 * Design Principles:
 * 1. Non-Sequential: Public references never reveal database autoincrement IDs,
 *    order velocity, or total customer transaction volume (ADR-005 security boundary).
 * 2. Unambiguous Alphabet: Characters prone to human confusion ('0', 'O', '1', 'I')
 *    are excluded from human-facing codes to ensure ease of communication during support calls.
 * 3. High Collision Resistance: 8+ Crockford-style alphanumeric characters provide
 *    over 1 trillion combinations per year prefix before birthday-bound collisions.
 * 4. Separate Public Identifiers from Internal IDs (FR-ORDER-003): Internal records use cuid(),
 *    while public-facing URLs and invoices use formatted public references.
 */

import { customAlphabet, nanoid } from "nanoid";

/**
 * Unambiguous uppercase alphanumeric alphabet (32 characters).
 * Excludes: '0' (zero), 'O' (letter O), '1' (one), 'I' (letter I).
 * Provides 5 bits of entropy per character.
 */
export const UNAMBIGUOUS_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

/**
 * Standard public reference alphabet generator (8 characters by default).
 */
const generateUnambiguousCode = customAlphabet(UNAMBIGUOUS_ALPHABET, 8);

/**
 * URL-safe token alphabet for session/checkout tokens (64 characters).
 */
export const URL_SAFE_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_-";
const generateSecureToken = customAlphabet(URL_SAFE_ALPHABET, 24);

export interface PublicReferenceOptions {
  prefix: string;
  year?: number;
  length?: number;
  alphabet?: string;
}

export interface ParsedReference {
  prefix: string;
  year: number | null;
  code: string;
  raw: string;
}

/**
 * Generate a non-sequential, public order reference.
 * Format: ORD-YYYY-XXXXXXXX (e.g. ORD-2026-X8K9M2P4)
 * Complies with FR-ORDER-002 & FR-ORDER-003.
 *
 * @param year Optional calendar year (defaults to current UTC year)
 * @param codeLength Optional length of the random code component (default: 8)
 */
export function generateOrderReference(year?: number, codeLength: number = 8): string {
  const effectiveYear = year ?? new Date().getUTCFullYear();
  const code = codeLength === 8 ? generateUnambiguousCode() : customAlphabet(UNAMBIGUOUS_ALPHABET, codeLength)();
  return `ORD-${effectiveYear}-${code}`;
}

/**
 * Generate a non-sequential, public return request reference.
 * Format: RET-YYYY-XXXXXXXX (e.g. RET-2026-7B8K4P9W)
 * Complies with FR-RETURN-002.
 *
 * @param year Optional calendar year (defaults to current UTC year)
 * @param codeLength Optional length of the random code component (default: 8)
 */
export function generateReturnReference(year?: number, codeLength: number = 8): string {
  const effectiveYear = year ?? new Date().getUTCFullYear();
  const code = codeLength === 8 ? generateUnambiguousCode() : customAlphabet(UNAMBIGUOUS_ALPHABET, codeLength)();
  return `RET-${effectiveYear}-${code}`;
}

/**
 * Generate a cryptographically random, non-guessable checkout session token.
 * Format: chk_<24-char-nanoid> (e.g. chk_9aB2c...kL1)
 * Used to securely identify ephemeral checkout sessions without exposing internal cart IDs.
 */
export function generateCheckoutToken(): string {
  return `chk_${generateSecureToken()}`;
}

/**
 * Generate a public payment attempt reference.
 * Format: PAY-YYYY-XXXXXXXX (e.g. PAY-2026-5K7R8N2Q)
 */
export function generatePaymentReference(year?: number, codeLength: number = 8): string {
  const effectiveYear = year ?? new Date().getUTCFullYear();
  const code = codeLength === 8 ? generateUnambiguousCode() : customAlphabet(UNAMBIGUOUS_ALPHABET, codeLength)();
  return `PAY-${effectiveYear}-${code}`;
}

/**
 * Generate a public refund reference.
 * Format: RFD-YYYY-XXXXXXXX (e.g. RFD-2026-6M9T1P3L)
 */
export function generateRefundReference(year?: number, codeLength: number = 8): string {
  const effectiveYear = year ?? new Date().getUTCFullYear();
  const code = codeLength === 8 ? generateUnambiguousCode() : customAlphabet(UNAMBIGUOUS_ALPHABET, codeLength)();
  return `RFD-${effectiveYear}-${code}`;
}

/**
 * Generate a shipment tracking reference.
 * Format: SHP-YYYY-XXXXXXXX (e.g. SHP-2026-8P2Q4M6N)
 */
export function generateShipmentReference(year?: number, codeLength: number = 8): string {
  const effectiveYear = year ?? new Date().getUTCFullYear();
  const code = codeLength === 8 ? generateUnambiguousCode() : customAlphabet(UNAMBIGUOUS_ALPHABET, codeLength)();
  return `SHP-${effectiveYear}-${code}`;
}

/**
 * Generic reference generator with custom prefix and options.
 */
export function generateCustomReference(options: PublicReferenceOptions): string {
  const { prefix, year, length = 8, alphabet = UNAMBIGUOUS_ALPHABET } = options;
  if (!prefix || !/^[A-Z0-9]+$/i.test(prefix)) {
    throw new Error(`Invalid reference prefix: "${prefix}". Prefix must be alphanumeric.`);
  }

  const generator = customAlphabet(alphabet, length);
  const code = generator();
  const normalizedPrefix = prefix.toUpperCase();

  if (year !== undefined) {
    return `${normalizedPrefix}-${year}-${code}`;
  }
  return `${normalizedPrefix}-${code}`;
}

/**
 * Generate an idempotency key if not supplied by the client.
 * Format: idemp_<nanoid>
 */
export function generateIdempotencyKey(): string {
  return `idemp_${nanoid(21)}`;
}

// =============================================================================
// Validation & Parsing Utilities
// =============================================================================

const ORDER_REF_REGEX = /^ORD-(20\d\d)-([23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4,16})$/;
const RETURN_REF_REGEX = /^RET-(20\d\d)-([23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4,16})$/;
const CHECKOUT_TOKEN_REGEX = /^chk_[A-Za-z0-9_-]{20,32}$/;
const GENERIC_REF_REGEX = /^([A-Z]{2,6})-(?:(20\d\d)-)?([23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4,16})$/;

/**
 * Validate that an order reference conforms strictly to the format ORD-YYYY-XXXX.
 */
export function isValidOrderReference(ref: unknown): ref is string {
  if (typeof ref !== "string") return false;
  return ORDER_REF_REGEX.test(ref.trim());
}

/**
 * Validate that a return reference conforms strictly to the format RET-YYYY-XXXX.
 */
export function isValidReturnReference(ref: unknown): ref is string {
  if (typeof ref !== "string") return false;
  return RETURN_REF_REGEX.test(ref.trim());
}

/**
 * Validate that a checkout token conforms to chk_<token>.
 */
export function isValidCheckoutToken(token: unknown): token is string {
  if (typeof token !== "string") return false;
  return CHECKOUT_TOKEN_REGEX.test(token.trim());
}

/**
 * Parse a structured public reference string into its constituent parts.
 * Returns null if the format is invalid.
 */
export function parseReference(reference: string): ParsedReference | null {
  if (!reference || typeof reference !== "string") return null;
  const trimmed = reference.trim().toUpperCase();
  const match = trimmed.match(GENERIC_REF_REGEX);
  if (!match) return null;

  const prefix = match[1];
  const yearStr = match[2];
  const code = match[3];

  return {
    prefix,
    year: yearStr ? parseInt(yearStr, 10) : null,
    code,
    raw: trimmed,
  };
}

/**
 * Normalize and sanitize a customer-entered reference string.
 * Strips accidental spaces and standardizes to uppercase.
 */
export function normalizeReference(reference: string): string {
  return reference.trim().replace(/\s+/g, "").toUpperCase();
}
