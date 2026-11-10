import {
  getIronSession,
  sealData,
  unsealData,
  type IronSession,
  type SessionOptions,
} from "iron-session";

/**
 * Authentication Session Service & Encryption Helpers
 * Complies with PRD Section 6.6 (FR-ACCOUNT-002), Section 18.1, and ADR-005.
 *
 * Rules:
 * - Sessions encrypted with iron-session (AES-256-GCM / HMAC signed).
 * - Enforces HttpOnly, SameSite=Lax, and Secure cookie flags.
 * - Password length validation (minimum 32 characters required by iron-session).
 * - Safe session destruction and role verification guards.
 */

// =============================================================================
// Constants & Configuration
// =============================================================================

export const DEFAULT_SESSION_COOKIE_NAME = "ecom_session";
export const DEFAULT_SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days in seconds
export const MIN_SECRET_LENGTH = 32;

/**
 * Fallback secret for local development and non-production testing.
 * Production environments MUST provide SESSION_SECRET with at least 32 characters.
 */
const DEV_FALLBACK_SECRET =
  "development-fallback-session-secret-min-32-chars-long-do-not-use-in-prod-xyz";

/**
 * Resolves and validates the session secret key.
 */
export function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "FATAL: SESSION_SECRET environment variable is missing in production environment."
      );
    }
    return DEV_FALLBACK_SECRET;
  }
  if (secret.length < MIN_SECRET_LENGTH) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        `FATAL: SESSION_SECRET must be at least ${MIN_SECRET_LENGTH} characters long (current length: ${secret.length}).`
      );
    }
    // Pad for dev/test if accidentally too short
    return secret.padEnd(MIN_SECRET_LENGTH, "0");
  }
  return secret;
}

/**
 * Generates IronSession configuration options.
 */
export function getSessionOptions(customOptions?: Partial<SessionOptions>): SessionOptions {
  const secret = getSessionSecret();
  const isProduction = process.env.NODE_ENV === "production";
  const isSecureCookie = isProduction || process.env.COOKIE_SECURE === "true";
  const cookieName =
    process.env.SESSION_COOKIE_NAME ||
    customOptions?.cookieName ||
    DEFAULT_SESSION_COOKIE_NAME;

  const ttl = customOptions?.ttl ?? DEFAULT_SESSION_TTL_SECONDS;

  return {
    cookieName,
    password: secret,
    ttl,
    cookieOptions: {
      httpOnly: true,
      secure: isSecureCookie,
      sameSite: "lax",
      path: "/",
      maxAge: ttl,
      ...customOptions?.cookieOptions,
    },
  };
}

/**
 * Default statically resolved session options.
 */
export const defaultSessionOptions: SessionOptions = getSessionOptions();

// =============================================================================
// Session Data Types & Contracts
// =============================================================================

export interface SessionUser {
  id: string;
  email: string;
  roles: string[];
  permissions?: string[];
  customerProfileId?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}

export interface SessionData {
  user?: SessionUser;
  isLoggedIn: boolean;
  guestCartId?: string;
  createdAt?: number;
  lastActiveAt?: number;
}

/**
 * Interface compatible with iron-session's CookieStore, Next.js CookieStore (next/headers),
 * and custom in-memory mock cookie jars.
 */
export interface CookieStoreLike {
  get(name: string): { name: string; value: string } | undefined | Promise<{ name: string; value: string } | undefined>;
  set(
    nameOrOptions: string | { name: string; value: string; [key: string]: unknown },
    value?: string
  ): void | unknown;
  delete?(name: string): void | unknown;
  has?(name: string): boolean;
}

export type CookieStoreTarget =
  | CookieStoreLike
  | Awaited<ReturnType<typeof import("next/headers").cookies>>;

type IronSessionCookieFn = (
  cookies: unknown,
  options: SessionOptions
) => Promise<IronSession<SessionData>>;

// =============================================================================
// Session Management Functions
// =============================================================================

/**
 * Retrieve or initialize an IronSession from a Next.js CookieStore or compatible cookie jar.
 *
 * @param cookies - Next.js CookieStore (from await cookies()) or mock CookieStoreLike
 * @param options - Optional custom session options
 * @returns IronSession instance wrapping SessionData
 */
export async function getSession(
  cookies: CookieStoreTarget,
  options: SessionOptions = getSessionOptions()
): Promise<IronSession<SessionData>> {
  // Pass to iron-session
  const session = await (getIronSession as unknown as IronSessionCookieFn)(cookies, options);
  if (session.isLoggedIn === undefined) {
    session.isLoggedIn = false;
  }
  return session;
}

/**
 * Helper to retrieve current session in Next.js Server Components, Actions, or Route Handlers.
 * Dynamically imports next/headers so node-based test environments do not fail during import.
 */
export async function getServerSession(
  customOptions?: Partial<SessionOptions>
): Promise<IronSession<SessionData>> {
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  return getSession(cookieStore, getSessionOptions(customOptions));
}

/**
 * Retrieve session from standard Web API Request and Response objects.
 * Useful for Next.js Route Handlers or middleware.
 */
export async function getSessionFromRequest(
  req: Request,
  res: Response,
  options: SessionOptions = getSessionOptions()
): Promise<IronSession<SessionData>> {
  const session = await getIronSession<SessionData>(req, res, options);
  if (session.isLoggedIn === undefined) {
    session.isLoggedIn = false;
  }
  return session;
}

/**
 * Authenticates a session by binding a SessionUser, setting timestamps, and saving to cookie store.
 *
 * @param cookies - CookieStore instance
 * @param user - Authenticated user details
 * @param guestCartId - Optional guest cart ID to preserve across auth boundary (PRD 6.5)
 */
export async function createSession(
  cookies: CookieStoreTarget,
  user: SessionUser,
  guestCartId?: string
): Promise<IronSession<SessionData>> {
  const session = await getSession(cookies);
  const now = Date.now();

  session.user = {
    id: user.id,
    email: user.email.toLowerCase(),
    roles: Array.from(new Set(user.roles || [])),
    permissions: user.permissions ? Array.from(new Set(user.permissions)) : [],
    customerProfileId: user.customerProfileId ?? null,
    firstName: user.firstName ?? null,
    lastName: user.lastName ?? null,
  };
  session.isLoggedIn = true;
  session.createdAt = now;
  session.lastActiveAt = now;

  if (guestCartId) {
    session.guestCartId = guestCartId;
  }

  await session.save();
  return session;
}

/**
 * Convenience helper to create authenticated session using Next.js cookies() directly.
 */
export async function createCurrentSession(
  user: SessionUser,
  guestCartId?: string
): Promise<IronSession<SessionData>> {
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  return createSession(cookieStore, user, guestCartId);
}

/**
 * Destroys an active session, removing the cookie and clearing all session data.
 */
export async function destroySession(
  cookies: CookieStoreTarget
): Promise<void> {
  const session = await getSession(cookies);
  session.destroy();
}

/**
 * Convenience helper to destroy active session using Next.js cookies() directly.
 */
export async function destroyCurrentSession(): Promise<void> {
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  return destroySession(cookieStore);
}

/**
 * Resolves authenticated user across Cookie session or Authorization: Bearer <seal> header.
 * Strictly typed with zero assertions.
 */
export async function getAuthenticatedUser(
  req?: Request
): Promise<SessionUser | null> {
  // 1. Try reading server session from cookie
  try {
    const session = await getServerSession();
    if (isSessionAuthenticated(session)) {
      return session.user;
    }
  } catch {
    // next/headers might throw outside of active request scope
  }

  // 2. Try Authorization: Bearer <seal> header
  if (req) {
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7).trim();
      const unsealed = await unsealSessionData<SessionData>(token);
      if (isSessionAuthenticated(unsealed)) {
        return unsealed.user;
      }
    }
  }

  return null;
}

/**
 * Resolves authenticated user ID across Cookie session or Authorization: Bearer <seal> header.
 */
export async function getAuthenticatedUserId(
  req?: Request
): Promise<string | null> {
  const user = await getAuthenticatedUser(req);
  return user ? user.id : null;
}

// =============================================================================
// Standalone Encryption Helpers (Web Crypto AES-256-GCM / HMAC via iron-session)
// =============================================================================

/**
 * Standalone encryption helper: Encrypts any arbitrary payload into a sealed string.
 *
 * @param data - Arbitrary data payload
 * @param ttl - Optional time-to-live in seconds
 * @returns Encrypted and signed seal string
 */
export async function sealSessionData<T = unknown>(
  data: T,
  ttl: number = DEFAULT_SESSION_TTL_SECONDS
): Promise<string> {
  const password = getSessionSecret();
  return sealData(data, { password, ttl });
}

/**
 * Standalone decryption helper: Decrypts and verifies a sealed string.
 *
 * @param seal - The encrypted seal string
 * @param ttl - Optional time-to-live validation in seconds
 * @returns Decrypted payload or null if invalid/expired
 */
export async function unsealSessionData<T = unknown>(
  seal: string,
  ttl: number = DEFAULT_SESSION_TTL_SECONDS
): Promise<T | null> {
  if (!seal || typeof seal !== "string") {
    return null;
  }
  const password = getSessionSecret();
  try {
    const data = await unsealData<T>(seal, { password, ttl });
    // iron-session returns {} on invalid, expired, or tampered seal
    if (!data || (typeof data === "object" && Object.keys(data).length === 0)) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

// =============================================================================
// Session Verification & RBAC Guards
// =============================================================================

/**
 * Type guard verifying if a session is currently authenticated with a valid user.
 */
export function isSessionAuthenticated(
  session: SessionData | null | undefined
): session is SessionData & { user: SessionUser } {
  return (
    Boolean(session) &&
    session?.isLoggedIn === true &&
    Boolean(session?.user?.id) &&
    Boolean(session?.user?.email)
  );
}

/**
 * Check if the session user possesses a specific role.
 */
export function hasRole(
  session: SessionData | null | undefined,
  roleName: string
): boolean {
  if (!isSessionAuthenticated(session)) {
    return false;
  }
  return session.user.roles.includes(roleName);
}

/**
 * Check if the session user possesses any of the required roles.
 */
export function hasAnyRole(
  session: SessionData | null | undefined,
  roleNames: string[]
): boolean {
  if (!isSessionAuthenticated(session)) {
    return false;
  }
  return roleNames.some((role) => session.user.roles.includes(role));
}

/**
 * Check if the session user possesses a specific permission key.
 */
export function hasPermission(
  session: SessionData | null | undefined,
  permissionKey: string
): boolean {
  if (!isSessionAuthenticated(session)) {
    return false;
  }
  // Super Admin bypasses granular permission checks
  if (session.user.roles.includes("SUPER_ADMIN")) {
    return true;
  }
  return Boolean(session.user.permissions?.includes(permissionKey));
}
