/**
 * Authentication Service
 * Complies with PRD Section 6.6 (FR-ACCOUNT-001, FR-ACCOUNT-002, FR-ACCOUNT-003),
 * Section 18.1, Section 18.2, and ADR-005.
 *
 * Responsibilities:
 * 1. User registration with automatic CustomerProfile creation and default REGISTERED_CUSTOMER role.
 * 2. Timing-safe credential verification resistant to timing side-channels.
 * 3. Account enumeration prevention on forgot-password workflows.
 * 4. High-entropy single-use password reset tokens with SHA-256 database hashing and 15-minute TTL.
 * 5. Password updates with bcrypt (12 rounds) and max-length boundary enforcement.
 */

import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/db";
import {
  hashPassword,
  verifyPassword,
  hashOpaqueToken,
  timingSafeEqualString,
} from "../../lib/crypto";

export class AuthError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export interface RegisterUserInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
}

export interface AuthUserResult {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
}

const DUMMY_BCRYPT_HASH =
  "$2a$12$e8uk7fWf8h4/O2K8B.oU2O8R0M0y9hH/z37p0v61R9D7D.wQe1gC.";

export class AuthService {
  /**
   * Registers a new customer account.
   */
  async register(input: RegisterUserInput): Promise<AuthUserResult> {
    const normalizedEmail = input.email.trim().toLowerCase();

    // Check if user already exists
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      throw new AuthError(
        "EMAIL_ALREADY_EXISTS",
        "An account with this email address already exists.",
        409
      );
    }

    const passwordHash = await hashPassword(input.password);

    try {
      // Atomic creation of Role (via upsert), User, CustomerProfile, and UserRole
      const result = await prisma.$transaction(async (tx) => {
        const customerRole = await tx.role.upsert({
          where: { name: "REGISTERED_CUSTOMER" },
          update: {},
          create: {
            name: "REGISTERED_CUSTOMER",
            description: "Registered Store Customer",
          },
        });

        const user = await tx.user.create({
          data: {
            email: normalizedEmail,
            phone: input.phone || null,
            passwordHash,
            status: "ACTIVE",
            customerProfile: {
              create: {
                firstName: input.firstName.trim(),
                lastName: input.lastName.trim(),
              },
            },
            userRoles: {
              create: {
                roleId: customerRole.id,
                scope: "GLOBAL",
              },
            },
          },
          include: {
            customerProfile: true,
            userRoles: {
              include: { role: true },
            },
          },
        });

        return user;
      });

      return {
        id: result.id,
        email: result.email,
        firstName: result.customerProfile?.firstName ?? input.firstName,
        lastName: result.customerProfile?.lastName ?? input.lastName,
        roles: result.userRoles.map((ur) => ur.role.name),
      };
    } catch (error) {
      // Concurrency guard: Catch database unique constraint collisions (P2002)
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new AuthError(
          "EMAIL_ALREADY_EXISTS",
          "An account with this email address already exists.",
          409
        );
      }
      throw error;
    }
  }

  /**
   * Authenticates user with email and password.
   * Utilizes constant-time verification when user is not found to prevent timing side-channel attacks.
   */
  async login(email: string, password: string): Promise<AuthUserResult> {
    const normalizedEmail = email.trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        customerProfile: true,
        userRoles: {
          include: { role: true },
        },
      },
    });

    if (!user) {
      // Execute constant-time bcrypt compare to equalize response timing
      await verifyPassword(password, DUMMY_BCRYPT_HASH);
      throw new AuthError(
        "INVALID_CREDENTIALS",
        "Invalid email or password.",
        401
      );
    }

    const isPasswordValid = await verifyPassword(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new AuthError(
        "INVALID_CREDENTIALS",
        "Invalid email or password.",
        401
      );
    }

    // Status check after password validation to prevent account status enumeration
    if (user.status !== "ACTIVE") {
      throw new AuthError(
        "ACCOUNT_SUSPENDED",
        "Your account is inactive or suspended. Please contact support.",
        403
      );
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.customerProfile?.firstName ?? "",
      lastName: user.customerProfile?.lastName ?? "",
      roles: user.userRoles.map((ur) => ur.role.name),
    };
  }

  /**
   * Requests a password reset.
   * Implements OWASP Anti-Enumeration: Always returns generic success message regardless of existence.
   */
  async requestPasswordReset(email: string): Promise<{
    message: string;
    resetToken?: string;
  }> {
    const normalizedEmail = email.trim().toLowerCase();
    const genericMessage =
      "If an account with that email exists, instructions have been sent to reset your password.";

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user || user.status !== "ACTIVE") {
      // Equalize response timing
      await verifyPassword("dummy", DUMMY_BCRYPT_HASH);
      return { message: genericMessage };
    }

    // Generate high-entropy 256-bit random reset token
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashOpaqueToken(rawToken);

    // 15-minute expiry per PRD Section 6.6
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await prisma.$transaction(async (tx) => {
      // Invalidate existing unused tokens for this user
      await tx.passwordResetToken.deleteMany({
        where: { userId: user.id },
      });

      // Store hashed token
      await tx.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
        },
      });

      // Enqueue notification outbox event
      await tx.outboxEvent.create({
        data: {
          eventType: "SEND_PASSWORD_RESET_EMAIL",
          payloadJson: JSON.stringify({
            userId: user.id,
            email: user.email,
            token: rawToken,
            expiresAt: expiresAt.toISOString(),
          }),
        },
      });
    });

    // Expose reset token exclusively when automated integration tests request it
    const exposeTokenForTesting =
      process.env.EXPOSE_RESET_TOKENS_FOR_TESTING === "true";

    return {
      message: genericMessage,
      ...(exposeTokenForTesting ? { resetToken: rawToken } : {}),
    };
  }

  /**
   * Resets password using a single-use token within its 15-minute validity window.
   */
  async resetPassword(rawToken: string, newPassword: string): Promise<boolean> {
    if (!rawToken || typeof rawToken !== "string") {
      throw new AuthError(
        "INVALID_TOKEN",
        "Password reset token is invalid or expired.",
        400
      );
    }

    const tokenHash = hashOpaqueToken(rawToken.trim());

    const resetRecord = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!resetRecord) {
      throw new AuthError(
        "INVALID_TOKEN",
        "Password reset token is invalid or expired.",
        400
      );
    }

    if (resetRecord.usedAt !== null) {
      throw new AuthError(
        "TOKEN_ALREADY_USED",
        "This password reset link has already been used.",
        400
      );
    }

    if (new Date() > resetRecord.expiresAt) {
      throw new AuthError(
        "TOKEN_EXPIRED",
        "Password reset token has expired. Please request a new link.",
        400
      );
    }

    const newPasswordHash = await hashPassword(newPassword);

    await prisma.$transaction(async (tx) => {
      // Update password hash
      await tx.user.update({
        where: { id: resetRecord.userId },
        data: { passwordHash: newPasswordHash },
      });

      // Mark token as used
      await tx.passwordResetToken.update({
        where: { id: resetRecord.id },
        data: { usedAt: new Date() },
      });

      // Purge any lingering tokens for this user
      await tx.passwordResetToken.deleteMany({
        where: {
          userId: resetRecord.userId,
          id: { not: resetRecord.id },
        },
      });

      // Create security audit log
      await tx.auditLog.create({
        data: {
          actorId: resetRecord.userId,
          action: "PASSWORD_RESET_COMPLETED",
          targetType: "User",
          targetId: resetRecord.userId,
          metadataDiff: JSON.stringify({
            reason: "Customer completed self-service password reset",
          }),
        },
      });
    });

    return true;
  }

  /**
   * Updates password for an authenticated user.
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AuthError("USER_NOT_FOUND", "User not found.", 404);
    }

    const isValid = await verifyPassword(currentPassword, user.passwordHash);
    if (!isValid) {
      throw new AuthError(
        "INVALID_CURRENT_PASSWORD",
        "Current password is incorrect.",
        400
      );
    }

    const newPasswordHash = await hashPassword(newPassword);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { passwordHash: newPasswordHash },
      });

      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: "PASSWORD_CHANGED",
          targetType: "User",
          targetId: userId,
          metadataDiff: JSON.stringify({
            reason: "Customer changed password while authenticated",
          }),
        },
      });
    });

    return true;
  }
}

export const authService = new AuthService();
