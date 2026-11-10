import bcrypt from "bcryptjs";
import crypto from "crypto";

/**
 * Cryptographic & Password Hashing Services
 * Complies with PRD Section 18.1, ADR-005, and OWASP Password Storage Guidelines.
 *
 * Rules:
 * - Default salt rounds = 12.
 * - Enforce maximum password input length to prevent bcrypt 72-byte truncation vulnerabilities.
 * - Safe comparison functions resistant to timing side-channel attacks.
 * - Opaque token hashing via SHA-256 for persistent database storage (reset tokens, API keys).
 */

export const DEFAULT_SALT_ROUNDS = 12;
export const MAX_PASSWORD_BYTES = 72;

/**
 * Resolve effective salt rounds from environment or fall back to default (12).
 */
export function getSaltRounds(): number {
  const envRounds = process.env.PASSWORD_SALT_ROUNDS;
  if (envRounds) {
    const parsed = parseInt(envRounds, 10);
    if (!isNaN(parsed) && parsed >= 10 && parsed <= 16) {
      return parsed;
    }
  }
  return DEFAULT_SALT_ROUNDS;
}

/**
 * Validates that the password string does not exceed bcrypt's 72-byte truncation boundary.
 */
function assertPasswordLength(password: string): void {
  if (!password || typeof password !== "string") {
    throw new Error("Password must be a non-empty string");
  }
  const byteLength = Buffer.byteLength(password, "utf8");
  if (byteLength > MAX_PASSWORD_BYTES) {
    throw new Error(
      `Password exceeds maximum allowed length of ${MAX_PASSWORD_BYTES} bytes (received ${byteLength} bytes).`
    );
  }
}

/**
 * Asynchronously hashes a plain text password using bcryptjs.
 *
 * @param password - Plain text password to hash (max 72 bytes)
 * @param saltRounds - Optional salt rounds override (defaults to 12)
 * @returns Promise resolving to the bcrypt hashed string (e.g. $2a$12$...)
 */
export async function hashPassword(
  password: string,
  saltRounds: number = getSaltRounds()
): Promise<string> {
  assertPasswordLength(password);
  const salt = await bcrypt.genSalt(saltRounds);
  return bcrypt.hash(password, salt);
}

/**
 * Asynchronously verifies a plain text password against a bcrypt hash.
 * Protects against timing attacks and safely returns false for malformed inputs.
 *
 * @param password - Plain text password attempt
 * @param hash - Stored bcrypt hash
 * @returns Promise resolving to true if matching, false otherwise
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  if (!password || !hash || typeof password !== "string" || typeof hash !== "string") {
    return false;
  }
  // Verify basic bcrypt hash structure ($2a$, $2b$, or $2y$)
  if (!hash.startsWith("$2a$") && !hash.startsWith("$2b$") && !hash.startsWith("$2y$")) {
    return false;
  }
  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}

/**
 * Synchronous version of hashPassword (useful for test seeding and initialization).
 */
export function hashPasswordSync(
  password: string,
  saltRounds: number = getSaltRounds()
): string {
  assertPasswordLength(password);
  const salt = bcrypt.genSaltSync(saltRounds);
  return bcrypt.hashSync(password, salt);
}

/**
 * Synchronous version of verifyPassword.
 */
export function verifyPasswordSync(password: string, hash: string): boolean {
  if (!password || !hash || typeof password !== "string" || typeof hash !== "string") {
    return false;
  }
  if (!hash.startsWith("$2a$") && !hash.startsWith("$2b$") && !hash.startsWith("$2y$")) {
    return false;
  }
  try {
    return bcrypt.compareSync(password, hash);
  } catch {
    return false;
  }
}

// =============================================================================
// Token & Entropy Utilities (FR-ACCOUNT-003, PRD Section 18.1)
// =============================================================================

/**
 * Generates a cryptographically secure random token in hexadecimal encoding.
 * Used for password reset tokens, email verification tokens, and guest tokens.
 *
 * @param byteLength - Number of random bytes (default: 32 bytes = 256 bits of entropy)
 * @returns Hex-encoded random string (e.g. 64 characters for 32 bytes)
 */
export function generateSecureToken(byteLength: number = 32): string {
  if (byteLength < 16) {
    throw new Error("Token byte length must be at least 16 bytes for cryptographic security");
  }
  return crypto.randomBytes(byteLength).toString("hex");
}

/**
 * Computes a deterministic SHA-256 hash of a sensitive token before saving it to the database.
 * This guarantees that even if the database is dumped, plain reset tokens cannot be abused.
 *
 * @param token - Raw plain token received by the customer
 * @returns Hex-encoded SHA-256 digest
 */
export function hashToken(token: string): string {
  if (!token || typeof token !== "string") {
    throw new Error("Token must be a non-empty string");
  }
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Timing-safe string comparison to prevent side-channel timing attacks.
 *
 * @param a - First string
 * @param b - Second string
 * @returns True if both strings are byte-for-byte identical
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") {
    return false;
  }
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}
