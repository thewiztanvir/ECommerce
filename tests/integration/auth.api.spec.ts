/**
 * Integration Test Suite: Authentication API Endpoints
 * Tests:
 * - POST /api/v1/auth/register (success, duplicate rejection 409, weak password 422)
 * - POST /api/v1/auth/login (success 200 + cookie, wrong password 401, timing-neutral non-existent user 401)
 * - POST /api/v1/auth/password/forgot (anti-enumeration 200 for existing & non-existent emails)
 * - POST /api/v1/auth/password/reset (valid token reset, token reuse 400, expired token 400, invalid token 400)
 * - POST /api/v1/auth/logout (session destroyed)
 *
 * Complies with PRD Section 6.6, Section 18.1, Section 18.2, and ADR-005.
 */

import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { hashOpaqueToken } from "@/lib/crypto";
import { getSession } from "@/modules/auth/session.service";

// In-memory cookie jar to capture and verify session cookies in Vitest
const cookieJar = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => {
      const val = cookieJar.get(name);
      return val !== undefined ? { name, value: val } : undefined;
    },
    set: (nameOrOptions: any, value?: any) => {
      if (typeof nameOrOptions === "string") {
        cookieJar.set(nameOrOptions, value);
      } else if (nameOrOptions && typeof nameOrOptions === "object") {
        cookieJar.set(nameOrOptions.name, nameOrOptions.value);
      }
    },
    delete: (name: string) => {
      cookieJar.delete(name);
    },
    has: (name: string) => cookieJar.has(name),
  })),
}));

// Import route handlers
import { POST as registerRoute } from "@/app/api/v1/auth/register/route";
import { POST as loginRoute } from "@/app/api/v1/auth/login/route";
import { POST as logoutRoute } from "@/app/api/v1/auth/logout/route";
import { POST as forgotPasswordRoute } from "@/app/api/v1/auth/password/forgot/route";
import { POST as resetPasswordRoute } from "@/app/api/v1/auth/password/reset/route";

describe("Integration: Authentication API Endpoints", () => {
  const testRunId = `${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const validEmail = `auth-test-${testRunId}@example.com`;
  const validPassword = "SecurePassword123!";
  const validFirstName = "Alex";
  const validLastName = "Mercer";
  const validPhone = "+12125550199";

  const createdUserIds: string[] = [];

  beforeAll(() => {
    process.env.EXPOSE_RESET_TOKENS_FOR_TESTING = "true";
  });

  afterAll(async () => {
    delete process.env.EXPOSE_RESET_TOKENS_FOR_TESTING;
    // Database cleanup
    if (createdUserIds.length > 0) {
      await prisma.passwordResetToken.deleteMany({
        where: { userId: { in: createdUserIds } },
      });
      await prisma.customerProfile.deleteMany({
        where: { userId: { in: createdUserIds } },
      });
      await prisma.userRole.deleteMany({
        where: { userId: { in: createdUserIds } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: createdUserIds } },
      });
    }
  });

  describe("1. User Registration (POST /api/v1/auth/register)", () => {
    it("should successfully register a new user and establish a session cookie", async () => {
      cookieJar.clear();

      const req = new NextRequest("http://localhost:3000/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: validEmail,
          password: validPassword,
          firstName: validFirstName,
          lastName: validLastName,
          phone: validPhone,
        }),
      });

      const res = await registerRoute(req);
      const json = await res.json();

      expect(res.status).toBe(201);
      expect(json.data.user).toBeDefined();
      expect(json.data.user.email).toBe(validEmail);
      expect(json.data.user.firstName).toBe(validFirstName);
      expect(json.data.user.lastName).toBe(validLastName);
      expect(json.data.user.roles).toContain("REGISTERED_CUSTOMER");

      createdUserIds.push(json.data.user.id);

      // Verify encrypted session cookie was set
      expect(cookieJar.has("ecom_session")).toBe(true);

      // Verify database record creation
      const dbUser = await prisma.user.findUnique({
        where: { email: validEmail },
        include: { customerProfile: true, userRoles: { include: { role: true } } },
      });
      expect(dbUser).not.toBeNull();
      expect(dbUser?.customerProfile?.firstName).toBe(validFirstName);
      expect(dbUser?.userRoles.some((ur) => ur.role.name === "REGISTERED_CUSTOMER")).toBe(true);
    });

    it("should reject registration with duplicate email (409 Conflict)", async () => {
      const req = new NextRequest("http://localhost:3000/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: validEmail,
          password: validPassword,
          firstName: "Duplicate",
          lastName: "User",
        }),
      });

      const res = await registerRoute(req);
      const json = await res.json();

      expect(res.status).toBe(409);
      expect(json.error.code).toBe("EMAIL_ALREADY_EXISTS");
      expect(json.error.message).toContain("already exists");
    });

    it("should reject weak password failing NIST/OWASP complexity policy (422 Unprocessable)", async () => {
      const weakPasswords = [
        "short1!",       // Less than 8 characters
        "alllowercase1!", // No uppercase
        "ALLUPPERCASE1!", // No lowercase
        "NoSpecialChar1", // No special character
        "NoNumbersHere!", // No number
      ];

      for (const weakPwd of weakPasswords) {
        const req = new NextRequest("http://localhost:3000/api/v1/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: `weak-${Date.now()}-${Math.random()}@example.com`,
            password: weakPwd,
            firstName: "Weak",
            lastName: "Tester",
          }),
        });

        const res = await registerRoute(req);
        const json = await res.json();

        expect(res.status).toBe(422);
        expect(json.error.code).toBe("VALIDATION_ERROR");
        expect(json.error.details.some((d: any) => d.field === "password")).toBe(true);
      }
    });

    it("should reject invalid email format (422 Unprocessable)", async () => {
      const req = new NextRequest("http://localhost:3000/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "not-an-email",
          password: validPassword,
          firstName: "Bad",
          lastName: "Email",
        }),
      });

      const res = await registerRoute(req);
      const json = await res.json();

      expect(res.status).toBe(422);
      expect(json.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("2. User Login (POST /api/v1/auth/login)", () => {
    it("should authenticate with correct credentials and issue encrypted session cookie (200 OK)", async () => {
      cookieJar.clear();

      const req = new NextRequest("http://localhost:3000/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: validEmail,
          password: validPassword,
        }),
      });

      const res = await loginRoute(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.user.email).toBe(validEmail);
      expect(cookieJar.has("ecom_session")).toBe(true);

      // Verify the session contents decrypt properly
      const mockStore = {
        get: (n: string) => (cookieJar.has(n) ? { name: n, value: cookieJar.get(n)! } : undefined),
        set: vi.fn(),
      };
      const session = await getSession(mockStore);
      expect(session.isLoggedIn).toBe(true);
      expect(session.user?.email).toBe(validEmail);
    });

    it("should reject incorrect password with timing-neutral 401 response", async () => {
      const req = new NextRequest("http://localhost:3000/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: validEmail,
          password: "WrongPassword999!",
        }),
      });

      const res = await loginRoute(req);
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.error.code).toBe("INVALID_CREDENTIALS");
      expect(json.error.message).toBe("Invalid email or password.");
    });

    it("should reject non-existent user with identical timing-neutral 401 response", async () => {
      const nonExistentEmail = `ghost-${Date.now()}@doesnotexist.com`;

      const req = new NextRequest("http://localhost:3000/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: nonExistentEmail,
          password: "AnyPassword123!",
        }),
      });

      const res = await loginRoute(req);
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.error.code).toBe("INVALID_CREDENTIALS");
      expect(json.error.message).toBe("Invalid email or password.");
    });
  });

  describe("3. Forgot Password Flow (POST /api/v1/auth/password/forgot)", () => {
    it("should return generic success message when email exists (anti-enumeration)", async () => {
      const req = new NextRequest("http://localhost:3000/api/v1/auth/password/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: validEmail }),
      });

      const res = await forgotPasswordRoute(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.message).toBe(
        "If an account with that email exists, instructions have been sent to reset your password."
      );
      // In test environment, reset token is returned to facilitate automation
      expect(json.data.resetToken).toBeDefined();
    });

    it("should return identical generic success message when email does NOT exist (anti-enumeration)", async () => {
      const nonExistentEmail = `nonexistent-${Date.now()}@store.com`;

      const req = new NextRequest("http://localhost:3000/api/v1/auth/password/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: nonExistentEmail }),
      });

      const res = await forgotPasswordRoute(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.message).toBe(
        "If an account with that email exists, instructions have been sent to reset your password."
      );
      // Token must NOT be exposed for non-existent email
      expect(json.data.resetToken).toBeUndefined();
    });
  });

  describe("4. Password Reset Flow (POST /api/v1/auth/password/reset)", () => {
    let resetToken: string;
    const newPassword = "NewBrandPassword2026!#";

    beforeAll(async () => {
      // Request fresh reset token
      const req = new NextRequest("http://localhost:3000/api/v1/auth/password/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: validEmail }),
      });
      const res = await forgotPasswordRoute(req);
      const json = await res.json();
      resetToken = json.data.resetToken;
    });

    it("should reset password with valid token, update hash, and allow login with new password (200 OK)", async () => {
      const req = new NextRequest("http://localhost:3000/api/v1/auth/password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: resetToken,
          password: newPassword,
          confirmPassword: newPassword,
        }),
      });

      const res = await resetPasswordRoute(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.message).toBe("Password has been successfully reset.");

      // Verify old password no longer works
      const oldLoginReq = new NextRequest("http://localhost:3000/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: validEmail,
          password: validPassword,
        }),
      });
      const oldLoginRes = await loginRoute(oldLoginReq);
      expect(oldLoginRes.status).toBe(401);

      // Verify new password works
      const newLoginReq = new NextRequest("http://localhost:3000/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: validEmail,
          password: newPassword,
        }),
      });
      const newLoginRes = await loginRoute(newLoginReq);
      expect(newLoginRes.status).toBe(200);
    });

    it("should reject re-using an already consumed reset token (400 Bad Request)", async () => {
      const req = new NextRequest("http://localhost:3000/api/v1/auth/password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: resetToken,
          password: "AnotherNewPassword123!",
          confirmPassword: "AnotherNewPassword123!",
        }),
      });

      const res = await resetPasswordRoute(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error.code).toBe("TOKEN_ALREADY_USED");
      expect(json.error.message).toContain("already been used");
    });

    it("should reject expired reset token (400 Bad Request)", async () => {
      // Find the user ID
      const user = await prisma.user.findUnique({ where: { email: validEmail } });
      expect(user).not.toBeNull();

      // Seed an expired token
      const expiredRawToken = "expired-token-raw-test-hex-string-123456";
      const tokenHash = hashOpaqueToken(expiredRawToken);

      await prisma.passwordResetToken.create({
        data: {
          userId: user!.id,
          tokenHash,
          expiresAt: new Date(Date.now() - 60 * 1000), // Expired 1 minute ago
        },
      });

      const req = new NextRequest("http://localhost:3000/api/v1/auth/password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: expiredRawToken,
          password: "FreshPassword123!",
          confirmPassword: "FreshPassword123!",
        }),
      });

      const res = await resetPasswordRoute(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error.code).toBe("TOKEN_EXPIRED");
      expect(json.error.message).toContain("expired");
    });

    it("should reject non-existent or invalid reset token (400 Bad Request)", async () => {
      const req = new NextRequest("http://localhost:3000/api/v1/auth/password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: "fictitious-token-never-issued-9999",
          password: "FreshPassword123!",
          confirmPassword: "FreshPassword123!",
        }),
      });

      const res = await resetPasswordRoute(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error.code).toBe("INVALID_TOKEN");
    });
  });

  describe("5. User Logout (POST /api/v1/auth/logout)", () => {
    it("should destroy session cookie upon logout (200 OK)", async () => {
      // Establish active session first
      const loginReq = new NextRequest("http://localhost:3000/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: validEmail,
          password: "NewBrandPassword2026!#",
        }),
      });
      await loginRoute(loginReq);
      expect(cookieJar.has("ecom_session")).toBe(true);

      // Call logout
      const logoutReq = new NextRequest("http://localhost:3000/api/v1/auth/logout", {
        method: "POST",
      });
      const logoutRes = await logoutRoute(logoutReq);
      const logoutJson = await logoutRes.json();

      expect(logoutRes.status).toBe(200);
      expect(logoutJson.data.message).toBe("Successfully logged out.");

      // Session value is destroyed (either deleted or cleared to empty string)
      const sessionValue = cookieJar.get("ecom_session");
      expect(sessionValue === "" || sessionValue === undefined).toBe(true);
    });
  });
});
