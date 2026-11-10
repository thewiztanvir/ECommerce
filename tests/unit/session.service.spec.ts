import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  getSessionOptions,
  getSessionSecret,
  sealSessionData,
  unsealSessionData,
  getSession,
  createSession,
  destroySession,
  isSessionAuthenticated,
  hasRole,
  hasAnyRole,
  hasPermission,
  type CookieStoreLike,
  type SessionUser,
  DEFAULT_SESSION_COOKIE_NAME,
} from "@/modules/auth/session.service";

/**
 * In-memory Mock CookieStore implementation matching Next.js cookies() contract.
 */
class MockCookieStore implements CookieStoreLike {
  private store = new Map<string, string>();

  get(name: string): { name: string; value: string } | undefined {
    const val = this.store.get(name);
    return val !== undefined ? { name, value: val } : undefined;
  }

  set(
    nameOrOptions: string | { name: string; value: string; [key: string]: unknown },
    value?: string
  ): void {
    if (typeof nameOrOptions === "object") {
      this.store.set(nameOrOptions.name, nameOrOptions.value);
    } else if (typeof nameOrOptions === "string" && typeof value === "string") {
      this.store.set(nameOrOptions, value);
    }
  }

  delete(name: string): void {
    this.store.delete(name);
  }

  getRaw(name: string): string | undefined {
    return this.store.get(name);
  }
}

describe("Session Service Unit Tests", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("1. Configuration & Security Flags", () => {
    it("should enforce HttpOnly, SameSite=Lax, and Secure cookie flags", () => {
      const options = getSessionOptions();
      expect(options.cookieOptions?.httpOnly).toBe(true);
      expect(options.cookieOptions?.sameSite).toBe("lax");
      expect(options.cookieOptions?.path).toBe("/");
      expect(typeof options.ttl).toBe("number");
    });

    it("should set Secure flag when NODE_ENV is production", () => {
      (process.env as any).NODE_ENV = "production";
      process.env.SESSION_SECRET =
        "a-very-long-production-session-secret-that-has-more-than-thirty-two-chars!";
      const options = getSessionOptions();
      expect(options.cookieOptions?.secure).toBe(true);
    });

    it("should respect COOKIE_SECURE override flag", () => {
      (process.env as any).NODE_ENV = "development";
      process.env.COOKIE_SECURE = "true";
      const options = getSessionOptions();
      expect(options.cookieOptions?.secure).toBe(true);
    });

    it("should throw in production if SESSION_SECRET is missing or under 32 characters", () => {
      (process.env as any).NODE_ENV = "production";
      delete process.env.SESSION_SECRET;
      expect(() => getSessionSecret()).toThrow(/SESSION_SECRET environment variable is missing/);

      process.env.SESSION_SECRET = "short";
      expect(() => getSessionSecret()).toThrow(/must be at least 32 characters long/);
    });
  });

  describe("2. Standalone Encryption & Decryption (seal / unseal)", () => {
    const payload = {
      userId: "usr_123",
      roles: ["CUSTOMER"],
      cartId: "cart_abc",
    };

    it("should encrypt and successfully decrypt arbitrary session payloads", async () => {
      const sealed = await sealSessionData(payload);
      expect(typeof sealed).toBe("string");
      expect(sealed.startsWith("Fe26.")).toBe(true); // iron seal prefix

      const unsealed = await unsealSessionData<typeof payload>(sealed);
      expect(unsealed).toEqual(payload);
    });

    it("should return null for tampered or invalid seal strings without throwing", async () => {
      const unsealedInvalid = await unsealSessionData("tampered.seal.string");
      expect(unsealedInvalid).toBeNull();

      const unsealedEmpty = await unsealSessionData("");
      expect(unsealedEmpty).toBeNull();

      const unsealedNull = await unsealSessionData(null as any);
      expect(unsealedNull).toBeNull();
    });

    it("should return null when unsealing with a different secret", async () => {
      const sealed = await sealSessionData(payload);
      process.env.SESSION_SECRET =
        "completely-different-password-secret-min-32-chars-long-987654";
      const unsealed = await unsealSessionData(sealed);
      expect(unsealed).toBeNull();
    });
  });

  describe("3. IronSession Lifecycle with CookieStore", () => {
    const testUser: SessionUser = {
      id: "usr_jane_doe_99",
      email: "jane.doe@example.com",
      roles: ["CUSTOMER", "CONTENT_EDITOR"],
      permissions: ["pages:edit", "media:upload"],
      customerProfileId: "prof_456",
      firstName: "Jane",
      lastName: "Doe",
    };

    it("should initialize unauthenticated session on empty cookie jar", async () => {
      const cookieJar = new MockCookieStore();
      const session = await getSession(cookieJar);
      expect(session.isLoggedIn).toBe(false);
      expect(session.user).toBeUndefined();
    });

    it("should create an authenticated session and persist cookie to cookie jar", async () => {
      const cookieJar = new MockCookieStore();
      const session = await createSession(cookieJar, testUser, "guest_cart_789");

      expect(session.isLoggedIn).toBe(true);
      expect(session.user?.id).toBe("usr_jane_doe_99");
      expect(session.guestCartId).toBe("guest_cart_789");
      expect(typeof session.createdAt).toBe("number");

      // Verify cookie was written to jar
      const cookieValue = cookieJar.getRaw(DEFAULT_SESSION_COOKIE_NAME);
      expect(cookieValue).toBeDefined();
      expect(cookieValue?.startsWith("Fe26.")).toBe(true);

      // Read back session using a new getSession call on the same cookie jar
      const restoredSession = await getSession(cookieJar);
      expect(restoredSession.isLoggedIn).toBe(true);
      expect(restoredSession.user?.email).toBe("jane.doe@example.com");
      expect(restoredSession.user?.roles).toContain("CUSTOMER");
      expect(restoredSession.user?.roles).toContain("CONTENT_EDITOR");
      expect(restoredSession.guestCartId).toBe("guest_cart_789");
    });

    it("should destroy session and clear cookie", async () => {
      const cookieJar = new MockCookieStore();
      await createSession(cookieJar, testUser);

      // Verify cookie exists
      expect(cookieJar.getRaw(DEFAULT_SESSION_COOKIE_NAME)).toBeDefined();

      // Destroy session
      await destroySession(cookieJar);

      // Verify cookie is empty
      const destroyedCookie = cookieJar.getRaw(DEFAULT_SESSION_COOKIE_NAME);
      expect(destroyedCookie === "" || destroyedCookie === undefined).toBe(true);
    });
  });

  describe("4. Verification & RBAC Guards", () => {
    const adminUser: SessionUser = {
      id: "usr_super_admin",
      email: "admin@store.com",
      roles: ["SUPER_ADMIN"],
      permissions: [],
    };

    const regularUser: SessionUser = {
      id: "usr_reg",
      email: "customer@store.com",
      roles: ["CUSTOMER"],
      permissions: ["orders:view_own"],
    };

    it("isSessionAuthenticated should correctly detect authenticated sessions", () => {
      expect(
        isSessionAuthenticated({
          isLoggedIn: true,
          user: regularUser,
        })
      ).toBe(true);

      expect(
        isSessionAuthenticated({
          isLoggedIn: false,
          user: regularUser,
        })
      ).toBe(false);

      expect(
        isSessionAuthenticated({
          isLoggedIn: true,
        })
      ).toBe(false);

      expect(isSessionAuthenticated(null)).toBe(false);
      expect(isSessionAuthenticated(undefined)).toBe(false);
    });

    it("hasRole should verify specific roles correctly", () => {
      const session = { isLoggedIn: true, user: regularUser };
      expect(hasRole(session, "CUSTOMER")).toBe(true);
      expect(hasRole(session, "SUPER_ADMIN")).toBe(false);
      expect(hasRole(null, "CUSTOMER")).toBe(false);
    });

    it("hasAnyRole should verify multiple role options", () => {
      const session = { isLoggedIn: true, user: regularUser };
      expect(hasAnyRole(session, ["SUPER_ADMIN", "CUSTOMER"])).toBe(true);
      expect(hasAnyRole(session, ["SUPER_ADMIN", "INVENTORY_MANAGER"])).toBe(false);
    });

    it("hasPermission should check granular permissions and grant bypass to SUPER_ADMIN", () => {
      const regularSession = { isLoggedIn: true, user: regularUser };
      expect(hasPermission(regularSession, "orders:view_own")).toBe(true);
      expect(hasPermission(regularSession, "inventory:adjust")).toBe(false);

      // SUPER_ADMIN bypasses all granular permission checks
      const adminSession = { isLoggedIn: true, user: adminUser };
      expect(hasPermission(adminSession, "inventory:adjust")).toBe(true);
      expect(hasPermission(adminSession, "finance:refund")).toBe(true);
    });
  });
});
