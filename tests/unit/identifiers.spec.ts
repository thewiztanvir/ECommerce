import { describe, it, expect } from "vitest";
import {
  generateOrderReference,
  generateReturnReference,
  generateCheckoutToken,
  generatePaymentReference,
  generateRefundReference,
  generateShipmentReference,
  generateCustomReference,
  generateIdempotencyKey,
  isValidOrderReference,
  isValidReturnReference,
  isValidCheckoutToken,
  parseReference,
  normalizeReference,
  UNAMBIGUOUS_ALPHABET,
} from "@/lib/identifiers";

describe("Identifiers & Reference Generator (PRD 8.1 / FR-ORDER-002, FR-ORDER-003)", () => {
  describe("Order References", () => {
    it("generates an order reference matching ORD-YYYY-XXXXXXXX format", () => {
      const currentYear = new Date().getUTCFullYear();
      const ref = generateOrderReference();

      expect(ref).toMatch(new RegExp(`^ORD-${currentYear}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$`));
      expect(isValidOrderReference(ref)).toBe(true);
    });

    it("respects explicitly specified year", () => {
      const ref = generateOrderReference(2026);
      expect(ref.startsWith("ORD-2026-")).toBe(true);
      expect(isValidOrderReference(ref)).toBe(true);
    });

    it("uses only unambiguous characters (no 0, O, 1, I)", () => {
      for (let i = 0; i < 100; i++) {
        const ref = generateOrderReference();
        const code = ref.split("-")[2];
        for (const char of code) {
          expect(UNAMBIGUOUS_ALPHABET).toContain(char);
          expect(["0", "O", "1", "I"]).not.toContain(char);
        }
      }
    });

    it("generates unique references across consecutive calls (non-sequential)", () => {
      const refs = new Set<string>();
      const iterations = 1000;

      for (let i = 0; i < iterations; i++) {
        refs.add(generateOrderReference(2026));
      }

      expect(refs.size).toBe(iterations);
    });

    it("validates valid order references", () => {
      expect(isValidOrderReference("ORD-2026-8K9N2P4W")).toBe(true);
      expect(isValidOrderReference("ORD-2025-A2B3C4D5")).toBe(true);
    });

    it("rejects invalid order references", () => {
      expect(isValidOrderReference("")).toBe(false);
      expect(isValidOrderReference(null)).toBe(false);
      expect(isValidOrderReference(undefined)).toBe(false);
      expect(isValidOrderReference(123)).toBe(false);
      // Contains ambiguous character 'O'
      expect(isValidOrderReference("ORD-2026-8K9NO2PW")).toBe(false);
      // Contains ambiguous character '1'
      expect(isValidOrderReference("ORD-2026-8K9N12PW")).toBe(false);
      // Malformed prefix
      expect(isValidOrderReference("INV-2026-8K9N2P4W")).toBe(false);
      // Malformed year
      expect(isValidOrderReference("ORD-1999-8K9N2P4W")).toBe(false);
    });
  });

  describe("Return References", () => {
    it("generates return reference matching RET-YYYY-XXXXXXXX format", () => {
      const currentYear = new Date().getUTCFullYear();
      const ref = generateReturnReference();

      expect(ref).toMatch(new RegExp(`^RET-${currentYear}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$`));
      expect(isValidReturnReference(ref)).toBe(true);
    });

    it("validates return references properly", () => {
      expect(isValidReturnReference("RET-2026-23456789")).toBe(true);
      expect(isValidReturnReference("ORD-2026-23456789")).toBe(false);
      expect(isValidReturnReference("RET-2026-1O0I")).toBe(false);
    });
  });

  describe("Checkout Tokens", () => {
    it("generates a secure checkout token prefixed with chk_", () => {
      const token = generateCheckoutToken();
      expect(token.startsWith("chk_")).toBe(true);
      expect(token.length).toBeGreaterThanOrEqual(28); // "chk_" (4) + 24
      expect(isValidCheckoutToken(token)).toBe(true);
    });

    it("generates high-entropy unique checkout tokens", () => {
      const tokens = new Set<string>();
      for (let i = 0; i < 500; i++) {
        tokens.add(generateCheckoutToken());
      }
      expect(tokens.size).toBe(500);
    });

    it("validates checkout tokens correctly", () => {
      expect(isValidCheckoutToken("chk_1234567890abcdef12345678")).toBe(true);
      expect(isValidCheckoutToken("chk_short")).toBe(false);
      expect(isValidCheckoutToken("tok_1234567890abcdef12345678")).toBe(false);
      expect(isValidCheckoutToken("")).toBe(false);
    });
  });

  describe("Payment, Refund & Shipment References", () => {
    it("generates correct payment references", () => {
      const ref = generatePaymentReference(2026);
      expect(ref).toMatch(/^PAY-2026-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/);
    });

    it("generates correct refund references", () => {
      const ref = generateRefundReference(2026);
      expect(ref).toMatch(/^RFD-2026-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/);
    });

    it("generates correct shipment references", () => {
      const ref = generateShipmentReference(2026);
      expect(ref).toMatch(/^SHP-2026-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/);
    });
  });

  describe("Custom Reference Generator", () => {
    it("generates custom references with year and custom prefix", () => {
      const ref = generateCustomReference({
        prefix: "INV",
        year: 2026,
        length: 6,
      });
      expect(ref).toMatch(/^INV-2026-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/);
    });

    it("generates custom references without year", () => {
      const ref = generateCustomReference({
        prefix: "TXN",
        length: 10,
      });
      expect(ref).toMatch(/^TXN-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{10}$/);
    });

    it("throws on invalid prefix", () => {
      expect(() =>
        generateCustomReference({ prefix: "BAD-PREFIX" })
      ).toThrow("Invalid reference prefix");
    });
  });

  describe("Idempotency Key Generator", () => {
    it("generates unique idempotency keys", () => {
      const key1 = generateIdempotencyKey();
      const key2 = generateIdempotencyKey();
      expect(key1.startsWith("idemp_")).toBe(true);
      expect(key1).not.toBe(key2);
    });
  });

  describe("Parsing & Normalization", () => {
    it("correctly parses order references", () => {
      const parsed = parseReference("ORD-2026-8K9N2P4W");
      expect(parsed).toEqual({
        prefix: "ORD",
        year: 2026,
        code: "8K9N2P4W",
        raw: "ORD-2026-8K9N2P4W",
      });
    });

    it("correctly parses references without a year", () => {
      const parsed = parseReference("TXN-8K9N2P4W");
      expect(parsed).toEqual({
        prefix: "TXN",
        year: null,
        code: "8K9N2P4W",
        raw: "TXN-8K9N2P4W",
      });
    });

    it("returns null for malformed references", () => {
      expect(parseReference("INVALID_STRING")).toBeNull();
      expect(parseReference("")).toBeNull();
    });

    it("normalizes customer input with whitespace and casing", () => {
      expect(normalizeReference("  ord-2026-8k9n2p4w  ")).toBe("ORD-2026-8K9N2P4W");
      expect(normalizeReference("ord - 2026 - 8k9n")).toBe("ORD-2026-8K9N");
    });
  });
});
