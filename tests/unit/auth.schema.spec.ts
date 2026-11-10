import { describe, it, expect } from "vitest";
import {
  registerSchema,
  registerPayloadSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  createAddressSchema,
  updateAddressSchema,
  validateSchema,
} from "@/lib/validations/auth.schema";

describe("Authentication & Address Schemas Unit Tests", () => {
  describe("1. Registration Schema (registerSchema)", () => {
    const validRegistration = {
      firstName: "Jane",
      lastName: "Doe",
      email: "Jane.Doe@Example.com",
      password: "SecurePassword123!",
      confirmPassword: "SecurePassword123!",
      phone: "+12125550123",
    };

    it("should accept valid registration details and normalize email", () => {
      const parsed = registerSchema.parse(validRegistration);
      expect(parsed.email).toBe("jane.doe@example.com");
      expect(parsed.firstName).toBe("Jane");
      expect(parsed.lastName).toBe("Doe");
      expect(parsed.password).toBe("SecurePassword123!");
    });

    it("should accept optional phone as undefined or empty string", () => {
      const { phone: _, ...withoutPhone } = validRegistration;
      const parsed1 = registerSchema.parse(withoutPhone);
      expect(parsed1.phone).toBeUndefined();

      const parsed2 = registerSchema.parse({ ...validRegistration, phone: "" });
      expect(parsed2.phone).toBe("");
    });

    it("should reject mismatched confirmPassword", () => {
      const result = registerSchema.safeParse({
        ...validRegistration,
        confirmPassword: "DifferentPassword123!",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("Passwords do not match");
        expect(result.error.issues[0].path).toContain("confirmPassword");
      }
    });

    it("should enforce password complexity rules", () => {
      // Too short (< 8 chars)
      expect(
        registerSchema.safeParse({
          ...validRegistration,
          password: "Ab1!",
          confirmPassword: "Ab1!",
        }).success
      ).toBe(false);

      // Exceeds 72 chars
      const longPass = "A1!" + "a".repeat(70);
      expect(
        registerSchema.safeParse({
          ...validRegistration,
          password: longPass,
          confirmPassword: longPass,
        }).success
      ).toBe(false);

      // Missing uppercase
      expect(
        registerSchema.safeParse({
          ...validRegistration,
          password: "password123!",
          confirmPassword: "password123!",
        }).success
      ).toBe(false);

      // Missing lowercase
      expect(
        registerSchema.safeParse({
          ...validRegistration,
          password: "PASSWORD123!",
          confirmPassword: "PASSWORD123!",
        }).success
      ).toBe(false);

      // Missing number
      expect(
        registerSchema.safeParse({
          ...validRegistration,
          password: "Password!",
          confirmPassword: "Password!",
        }).success
      ).toBe(false);

      // Missing special character
      expect(
        registerSchema.safeParse({
          ...validRegistration,
          password: "Password123",
          confirmPassword: "Password123",
        }).success
      ).toBe(false);
    });

    it("should reject invalid email formats", () => {
      expect(
        registerSchema.safeParse({ ...validRegistration, email: "invalid-email" }).success
      ).toBe(false);
      expect(
        registerSchema.safeParse({ ...validRegistration, email: "@domain.com" }).success
      ).toBe(false);
      expect(
        registerSchema.safeParse({ ...validRegistration, email: "" }).success
      ).toBe(false);
    });

    it("should reject empty names", () => {
      expect(
        registerSchema.safeParse({ ...validRegistration, firstName: "" }).success
      ).toBe(false);
      expect(
        registerSchema.safeParse({ ...validRegistration, lastName: "   " }).success
      ).toBe(false);
    });
  });

  describe("2. Register Payload Schema (registerPayloadSchema)", () => {
    it("should accept valid payload without confirmPassword", () => {
      const payload = {
        firstName: "Alice",
        lastName: "Smith",
        email: "alice@example.com",
        password: "StrongPassword89#",
      };
      const parsed = registerPayloadSchema.parse(payload);
      expect(parsed.email).toBe("alice@example.com");
      expect(parsed.firstName).toBe("Alice");
    });
  });

  describe("3. Login Schema (loginSchema)", () => {
    it("should validate valid login credentials", () => {
      const parsed = loginSchema.parse({
        email: "  USER@Example.COM  ",
        password: "anyPassword123",
        rememberMe: true,
      });
      expect(parsed.email).toBe("user@example.com");
      expect(parsed.password).toBe("anyPassword123");
      expect(parsed.rememberMe).toBe(true);
    });

    it("should default rememberMe to false when omitted", () => {
      const parsed = loginSchema.parse({
        email: "user@example.com",
        password: "anyPassword",
      });
      expect(parsed.rememberMe).toBe(false);
    });

    it("should reject empty password or email", () => {
      expect(loginSchema.safeParse({ email: "user@example.com", password: "" }).success).toBe(
        false
      );
      expect(loginSchema.safeParse({ email: "", password: "password" }).success).toBe(false);
    });
  });

  describe("4. Password Reset Schemas", () => {
    describe("forgotPasswordSchema", () => {
      it("should accept valid email", () => {
        const parsed = forgotPasswordSchema.parse({ email: "Test@Domain.com" });
        expect(parsed.email).toBe("test@domain.com");
      });

      it("should reject invalid email", () => {
        expect(forgotPasswordSchema.safeParse({ email: "not-an-email" }).success).toBe(false);
      });
    });

    describe("resetPasswordSchema", () => {
      it("should accept valid token and matching new password", () => {
        const parsed = resetPasswordSchema.parse({
          token: "reset-token-abc-123",
          password: "NewPassword2026!",
          confirmPassword: "NewPassword2026!",
        });
        expect(parsed.token).toBe("reset-token-abc-123");
        expect(parsed.password).toBe("NewPassword2026!");
      });

      it("should reject empty token or mismatched passwords", () => {
        expect(
          resetPasswordSchema.safeParse({
            token: "",
            password: "NewPassword2026!",
            confirmPassword: "NewPassword2026!",
          }).success
        ).toBe(false);

        expect(
          resetPasswordSchema.safeParse({
            token: "valid-token",
            password: "NewPassword2026!",
            confirmPassword: "DifferentPassword2026!",
          }).success
        ).toBe(false);
      });
    });

    describe("changePasswordSchema", () => {
      it("should accept valid change password payload", () => {
        const parsed = changePasswordSchema.parse({
          currentPassword: "OldPassword123!",
          newPassword: "NewPassword2026!",
          confirmNewPassword: "NewPassword2026!",
        });
        expect(parsed.currentPassword).toBe("OldPassword123!");
        expect(parsed.newPassword).toBe("NewPassword2026!");
      });

      it("should reject when new password equals current password", () => {
        const result = changePasswordSchema.safeParse({
          currentPassword: "SamePassword123!",
          newPassword: "SamePassword123!",
          confirmNewPassword: "SamePassword123!",
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues.some((i) => i.message.includes("must be different"))).toBe(
            true
          );
        }
      });
    });
  });

  describe("5. Address Schemas (createAddressSchema & updateAddressSchema)", () => {
    const validAddress = {
      recipientName: "John Smith",
      type: "SHIPPING" as const,
      streetLine1: "123 Broadway Blvd",
      streetLine2: "Suite 4B",
      city: "New York",
      state: "NY",
      postalCode: "10001",
      countryCode: "us",
      phone: "+12125550199",
      isDefault: true,
    };

    it("should accept valid address and normalize countryCode to uppercase", () => {
      const parsed = createAddressSchema.parse(validAddress);
      expect(parsed.countryCode).toBe("US");
      expect(parsed.recipientName).toBe("John Smith");
      expect(parsed.isDefault).toBe(true);
      expect(parsed.type).toBe("SHIPPING");
    });

    it("should default type to SHIPPING and countryCode to US if omitted", () => {
      const minimal = {
        recipientName: "Alice Baker",
        streetLine1: "456 Market St",
        city: "San Francisco",
        state: "CA",
        postalCode: "94105",
      };
      const parsed = createAddressSchema.parse(minimal);
      expect(parsed.type).toBe("SHIPPING");
      expect(parsed.countryCode).toBe("US");
      expect(parsed.isDefault).toBe(false);
      expect(parsed.streetLine2).toBeUndefined();
    });

    it("should support BILLING address type", () => {
      const parsed = createAddressSchema.parse({
        ...validAddress,
        type: "BILLING",
      });
      expect(parsed.type).toBe("BILLING");
    });

    it("should reject invalid postal codes containing prohibited characters", () => {
      expect(
        createAddressSchema.safeParse({
          ...validAddress,
          postalCode: "10001<script>",
        }).success
      ).toBe(false);
    });

    it("should allow postal codes with hyphens and spaces (e.g. UK / Canada / US+4)", () => {
      expect(
        createAddressSchema.safeParse({
          ...validAddress,
          postalCode: "SW1A 1AA",
          countryCode: "GB",
        }).success
      ).toBe(true);

      expect(
        createAddressSchema.safeParse({
          ...validAddress,
          postalCode: "10001-1234",
        }).success
      ).toBe(true);
    });

    it("should validate updateAddressSchema with partial properties", () => {
      const updateData = {
        streetLine1: "789 New St",
        isDefault: false,
      };
      const parsed = updateAddressSchema.parse(updateData);
      expect(parsed.streetLine1).toBe("789 New St");
      expect(parsed.isDefault).toBe(false);
      expect(parsed.city).toBeUndefined();
    });
  });

  describe("6. Validation Helper (validateSchema)", () => {
    it("should return success: true and data on valid input", () => {
      const res = validateSchema(loginSchema, {
        email: "user@example.com",
        password: "Password123!",
      });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.email).toBe("user@example.com");
      }
    });

    it("should return success: false and formatted error map on invalid input", () => {
      const res = validateSchema(loginSchema, {
        email: "invalid-email",
        password: "",
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.errors["email"]).toBeDefined();
        expect(res.errors["password"]).toBeDefined();
      }
    });
  });
});
