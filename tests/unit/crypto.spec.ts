import { describe, it, expect } from "vitest";
import {
  hashPassword,
  verifyPassword,
  hashPasswordSync,
  verifyPasswordSync,
  generateSecureToken,
  hashToken,
  timingSafeEqual,
  DEFAULT_SALT_ROUNDS,
  MAX_PASSWORD_BYTES,
} from "@/lib/crypto";

describe("Cryptographic Utilities Unit Tests", () => {
  const samplePassword = "CorrectHorseBatteryStaple2026!";

  describe("1. Password Hashing (Async)", () => {
    it("should hash a plain password and produce a valid bcrypt hash", async () => {
      const hash = await hashPassword(samplePassword);
      expect(typeof hash).toBe("string");
      expect(hash.startsWith("$2a$") || hash.startsWith("$2b$")).toBe(true);
      // Cost factor 12
      expect(hash.includes("$12$")).toBe(true);
    });

    it("should verify correct password against hash", async () => {
      const hash = await hashPassword(samplePassword);
      const isMatch = await verifyPassword(samplePassword, hash);
      expect(isMatch).toBe(true);
    });

    it("should reject incorrect password against hash", async () => {
      const hash = await hashPassword(samplePassword);
      const isMatch = await verifyPassword("WrongPassword123!", hash);
      expect(isMatch).toBe(false);
    });

    it("should produce unique salts for identical passwords", async () => {
      const hash1 = await hashPassword(samplePassword);
      const hash2 = await hashPassword(samplePassword);
      expect(hash1).not.toBe(hash2);
      expect(await verifyPassword(samplePassword, hash1)).toBe(true);
      expect(await verifyPassword(samplePassword, hash2)).toBe(true);
    });

    it("should reject passwords exceeding 72 bytes", async () => {
      const longPassword = "A".repeat(MAX_PASSWORD_BYTES + 1);
      await expect(hashPassword(longPassword)).rejects.toThrow(
        /exceeds maximum allowed length/
      );
    });

    it("should reject empty passwords", async () => {
      await expect(hashPassword("")).rejects.toThrow(/must be a non-empty string/);
    });

    it("should safely return false for malformed or empty hash without throwing", async () => {
      expect(await verifyPassword(samplePassword, "")).toBe(false);
      expect(await verifyPassword(samplePassword, "invalid-hash")).toBe(false);
      expect(await verifyPassword(samplePassword, "$2a$invalid")).toBe(false);
      expect(await verifyPassword("", "$2a$12$something")).toBe(false);
    });
  });

  describe("2. Password Hashing (Sync)", () => {
    it("should hash and verify passwords synchronously", () => {
      const hash = hashPasswordSync(samplePassword);
      expect(typeof hash).toBe("string");
      expect(verifyPasswordSync(samplePassword, hash)).toBe(true);
      expect(verifyPasswordSync("WrongPassword!", hash)).toBe(false);
    });

    it("should safely return false for invalid hash synchronously", () => {
      expect(verifyPasswordSync(samplePassword, "")).toBe(false);
      expect(verifyPasswordSync(samplePassword, "invalid-hash")).toBe(false);
    });
  });

  describe("3. Secure Token Generation & Hashing", () => {
    it("should generate random hex tokens of default length (32 bytes = 64 hex chars)", () => {
      const token1 = generateSecureToken();
      const token2 = generateSecureToken();
      expect(token1).toHaveLength(64);
      expect(token2).toHaveLength(64);
      expect(token1).not.toBe(token2);
    });

    it("should support custom byte lengths", () => {
      const token16 = generateSecureToken(16);
      expect(token16).toHaveLength(32); // 16 bytes * 2 hex chars

      const token48 = generateSecureToken(48);
      expect(token48).toHaveLength(96);
    });

    it("should reject token requests with insufficient entropy (< 16 bytes)", () => {
      expect(() => generateSecureToken(8)).toThrow(/must be at least 16 bytes/);
    });

    it("should compute deterministic SHA-256 hashes of tokens", () => {
      const rawToken = "d6b856a94f1c901ef0728c045bda39a3";
      const hash1 = hashToken(rawToken);
      const hash2 = hashToken(rawToken);
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 produces 64 hex characters
    });

    it("should reject empty token for hashToken", () => {
      expect(() => hashToken("")).toThrow(/must be a non-empty string/);
    });
  });

  describe("4. Timing-Safe String Comparison", () => {
    it("should return true for identical strings", () => {
      expect(timingSafeEqual("secretToken123", "secretToken123")).toBe(true);
    });

    it("should return false for strings with differing lengths", () => {
      expect(timingSafeEqual("short", "longerString")).toBe(false);
    });

    it("should return false for strings with identical length but differing characters", () => {
      expect(timingSafeEqual("secretToken123", "secretToken124")).toBe(false);
    });

    it("should return false for invalid input types", () => {
      expect(timingSafeEqual("secret" as any, null as any)).toBe(false);
    });
  });
});
