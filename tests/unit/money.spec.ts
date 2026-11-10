import { describe, it, expect } from "vitest";
import { MoneyEngine, Money } from "@/lib/money";

describe("MoneyEngine Unit Tests", () => {
  describe("1. Minor Unit Conversions", () => {
    describe("fromDecimal", () => {
      it("should convert numeric decimals to integer minor units", () => {
        expect(MoneyEngine.fromDecimal(19.99)).toEqual({
          amountMinor: 1999,
          currency: "USD",
        });
        expect(MoneyEngine.fromDecimal(0)).toEqual({
          amountMinor: 0,
          currency: "USD",
        });
        expect(MoneyEngine.fromDecimal(0.01)).toEqual({
          amountMinor: 1,
          currency: "USD",
        });
        expect(MoneyEngine.fromDecimal(100)).toEqual({
          amountMinor: 10000,
          currency: "USD",
        });
      });

      it("should eliminate classic floating-point arithmetic artifacts", () => {
        // In JS: 0.1 + 0.2 = 0.30000000000000004
        expect(MoneyEngine.fromDecimal(0.1 + 0.2)).toEqual({
          amountMinor: 30,
          currency: "USD",
        });
        // In JS: 19.99 * 100 is 1998.9999999999998, Math.round ensures it becomes 1999
        expect(MoneyEngine.fromDecimal(19.99)).toEqual({
          amountMinor: 1999,
          currency: "USD",
        });
        // In JS: 59.99 * 100 or other prices with 2 decimal places
        expect(MoneyEngine.fromDecimal(59.99)).toEqual({
          amountMinor: 5999,
          currency: "USD",
        });
        expect(MoneyEngine.fromDecimal(0.05)).toEqual({
          amountMinor: 5,
          currency: "USD",
        });
      });

      it("should convert string decimal values accurately", () => {
        expect(MoneyEngine.fromDecimal("19.99")).toEqual({
          amountMinor: 1999,
          currency: "USD",
        });
        expect(MoneyEngine.fromDecimal("0.00")).toEqual({
          amountMinor: 0,
          currency: "USD",
        });
        expect(MoneyEngine.fromDecimal("1234.56")).toEqual({
          amountMinor: 123456,
          currency: "USD",
        });
        expect(MoneyEngine.fromDecimal(".99")).toEqual({
          amountMinor: 99,
          currency: "USD",
        });
      });

      it("should handle custom currencies and normalize them to uppercase", () => {
        expect(MoneyEngine.fromDecimal(25.5, "eur")).toEqual({
          amountMinor: 2550,
          currency: "EUR",
        });
        expect(MoneyEngine.fromDecimal("10.00", "gbp")).toEqual({
          amountMinor: 1000,
          currency: "GBP",
        });
        expect(MoneyEngine.fromDecimal(500, "JPY")).toEqual({
          amountMinor: 50000,
          currency: "JPY",
        });
      });

      it("should support negative decimal amounts", () => {
        expect(MoneyEngine.fromDecimal(-19.99)).toEqual({
          amountMinor: -1999,
          currency: "USD",
        });
        expect(MoneyEngine.fromDecimal("-15.50")).toEqual({
          amountMinor: -1550,
          currency: "USD",
        });
      });

      it("should throw an error on invalid or non-finite inputs", () => {
        expect(() => MoneyEngine.fromDecimal("invalid")).toThrow(/Invalid monetary amount/);
        expect(() => MoneyEngine.fromDecimal("abc123")).toThrow(/Invalid monetary amount/);
        expect(() => MoneyEngine.fromDecimal(NaN)).toThrow(/Invalid monetary amount/);
        expect(() => MoneyEngine.fromDecimal(Infinity)).toThrow(/Invalid monetary amount/);
        expect(() => MoneyEngine.fromDecimal(-Infinity)).toThrow(/Invalid monetary amount/);
      });
    });

    describe("toDecimal", () => {
      it("should convert integer minor units to formatted decimal string", () => {
        expect(MoneyEngine.toDecimal({ amountMinor: 1999, currency: "USD" })).toBe("19.99");
        expect(MoneyEngine.toDecimal({ amountMinor: 0, currency: "USD" })).toBe("0.00");
        expect(MoneyEngine.toDecimal({ amountMinor: 1, currency: "USD" })).toBe("0.01");
        expect(MoneyEngine.toDecimal({ amountMinor: 5, currency: "USD" })).toBe("0.05");
        expect(MoneyEngine.toDecimal({ amountMinor: 9, currency: "USD" })).toBe("0.09");
        expect(MoneyEngine.toDecimal({ amountMinor: 50, currency: "USD" })).toBe("0.50");
        expect(MoneyEngine.toDecimal({ amountMinor: 100000, currency: "USD" })).toBe("1000.00");
      });

      it("should format negative minor units properly", () => {
        expect(MoneyEngine.toDecimal({ amountMinor: -1999, currency: "USD" })).toBe("-19.99");
        expect(MoneyEngine.toDecimal({ amountMinor: -5, currency: "USD" })).toBe("-0.05");
      });
    });

    describe("format", () => {
      it("should format money for en-US customer display", () => {
        const formatted = MoneyEngine.format({ amountMinor: 1999, currency: "USD" });
        expect(formatted).toBe("$19.99");

        const formattedZero = MoneyEngine.format({ amountMinor: 0, currency: "USD" });
        expect(formattedZero).toBe("$0.00");
      });

      it("should format money for international locales and currencies", () => {
        const formattedEur = MoneyEngine.format({ amountMinor: 2500, currency: "EUR" }, "en-US");
        expect(formattedEur).toContain("€25.00");

        const formattedGbp = MoneyEngine.format({ amountMinor: 4999, currency: "GBP" }, "en-US");
        expect(formattedGbp).toContain("£49.99");
      });
    });
  });

  describe("2. Additions and Subtractions (with Negative Protection)", () => {
    describe("add", () => {
      it("should add two positive money amounts of identical currency", () => {
        const a: Money = { amountMinor: 1000, currency: "USD" };
        const b: Money = { amountMinor: 2000, currency: "USD" };
        expect(MoneyEngine.add(a, b)).toEqual({
          amountMinor: 3000,
          currency: "USD",
        });
      });

      it("should handle adding zero amounts", () => {
        const a: Money = { amountMinor: 1550, currency: "USD" };
        const zero: Money = { amountMinor: 0, currency: "USD" };
        expect(MoneyEngine.add(a, zero)).toEqual({
          amountMinor: 1550,
          currency: "USD",
        });
        expect(MoneyEngine.add(zero, zero)).toEqual({
          amountMinor: 0,
          currency: "USD",
        });
      });

      it("should handle adding negative money amounts", () => {
        const a: Money = { amountMinor: 2000, currency: "USD" };
        const negative: Money = { amountMinor: -500, currency: "USD" };
        expect(MoneyEngine.add(a, negative)).toEqual({
          amountMinor: 1500,
          currency: "USD",
        });
      });
    });

    describe("subtract", () => {
      it("should subtract smaller amount from larger amount", () => {
        const a: Money = { amountMinor: 5000, currency: "USD" };
        const b: Money = { amountMinor: 1500, currency: "USD" };
        expect(MoneyEngine.subtract(a, b)).toEqual({
          amountMinor: 3500,
          currency: "USD",
        });
      });

      it("should return zero when subtracting identical amounts", () => {
        const a: Money = { amountMinor: 2500, currency: "USD" };
        const b: Money = { amountMinor: 2500, currency: "USD" };
        expect(MoneyEngine.subtract(a, b)).toEqual({
          amountMinor: 0,
          currency: "USD",
        });
      });

      it("should apply negative protection by default (allowNegative = false, clamping to 0)", () => {
        const a: Money = { amountMinor: 1000, currency: "USD" };
        const b: Money = { amountMinor: 2500, currency: "USD" };
        // a - b is negative (-1500), but must clamp to 0
        expect(MoneyEngine.subtract(a, b)).toEqual({
          amountMinor: 0,
          currency: "USD",
        });

        // Zero minus positive
        const zero: Money = { amountMinor: 0, currency: "USD" };
        expect(MoneyEngine.subtract(zero, a)).toEqual({
          amountMinor: 0,
          currency: "USD",
        });
      });

      it("should allow negative results when allowNegative is explicitly true", () => {
        const a: Money = { amountMinor: 1000, currency: "USD" };
        const b: Money = { amountMinor: 2500, currency: "USD" };
        expect(MoneyEngine.subtract(a, b, true)).toEqual({
          amountMinor: -1500,
          currency: "USD",
        });

        // Positive outcome with allowNegative = true
        expect(MoneyEngine.subtract(b, a, true)).toEqual({
          amountMinor: 1500,
          currency: "USD",
        });

        const zero: Money = { amountMinor: 0, currency: "USD" };
        expect(MoneyEngine.subtract(zero, a, true)).toEqual({
          amountMinor: -1000,
          currency: "USD",
        });
      });
    });
  });

  describe("3. Multiplication by Quantities", () => {
    it("should multiply money by an integer quantity", () => {
      const unitPrice: Money = { amountMinor: 1999, currency: "USD" };
      expect(MoneyEngine.multiply(unitPrice, 1)).toEqual({
        amountMinor: 1999,
        currency: "USD",
      });
      expect(MoneyEngine.multiply(unitPrice, 3)).toEqual({
        amountMinor: 5997,
        currency: "USD",
      });
      expect(MoneyEngine.multiply(unitPrice, 10)).toEqual({
        amountMinor: 19990,
        currency: "USD",
      });
    });

    it("should return zero when multiplied by quantity of zero", () => {
      const unitPrice: Money = { amountMinor: 4999, currency: "USD" };
      expect(MoneyEngine.multiply(unitPrice, 0)).toEqual({
        amountMinor: 0,
        currency: "USD",
      });
    });

    it("should throw an error for negative quantities", () => {
      const unitPrice: Money = { amountMinor: 1999, currency: "USD" };
      expect(() => MoneyEngine.multiply(unitPrice, -1)).toThrow(
        /Quantity must be a positive integer/
      );
      expect(() => MoneyEngine.multiply(unitPrice, -5)).toThrow(
        /Quantity must be a positive integer/
      );
    });

    it("should throw an error for non-integer fractional quantities", () => {
      const unitPrice: Money = { amountMinor: 1999, currency: "USD" };
      expect(() => MoneyEngine.multiply(unitPrice, 1.5)).toThrow(
        /Quantity must be a positive integer/
      );
      expect(() => MoneyEngine.multiply(unitPrice, 0.25)).toThrow(
        /Quantity must be a positive integer/
      );
      expect(() => MoneyEngine.multiply(unitPrice, NaN)).toThrow(
        /Quantity must be a positive integer/
      );
    });
  });

  describe("4. Percentage Discount in Basis Points (1000 bps = 10%) with Half-Up Rounding", () => {
    it("should calculate exact discounts correctly", () => {
      const subtotal: Money = { amountMinor: 10000, currency: "USD" }; // $100.00

      // 1000 bps = 10% -> $10.00 discount
      expect(MoneyEngine.applyPercentageDiscount(subtotal, 1000)).toEqual({
        amountMinor: 1000,
        currency: "USD",
      });

      // 2500 bps = 25% -> $25.00 discount
      expect(MoneyEngine.applyPercentageDiscount(subtotal, 2500)).toEqual({
        amountMinor: 2500,
        currency: "USD",
      });

      // 500 bps = 5% -> $5.00 discount
      expect(MoneyEngine.applyPercentageDiscount(subtotal, 500)).toEqual({
        amountMinor: 500,
        currency: "USD",
      });
    });

    it("should handle boundary basis points (0 bps and 10000 bps)", () => {
      const subtotal: Money = { amountMinor: 8500, currency: "USD" }; // $85.00

      // 0 bps = 0% -> $0.00
      expect(MoneyEngine.applyPercentageDiscount(subtotal, 0)).toEqual({
        amountMinor: 0,
        currency: "USD",
      });

      // 10000 bps = 100% -> Full subtotal $85.00
      expect(MoneyEngine.applyPercentageDiscount(subtotal, 10000)).toEqual({
        amountMinor: 8500,
        currency: "USD",
      });
    });

    it("should perform round half-up for fractional cents", () => {
      // 1999 cents * 1000 bps (10%) = 199.9 cents -> rounds half-up to 200 cents
      const price1999: Money = { amountMinor: 1999, currency: "USD" };
      expect(MoneyEngine.applyPercentageDiscount(price1999, 1000)).toEqual({
        amountMinor: 200,
        currency: "USD",
      });

      // 50 cents * 100 bps (1%) = 0.5 cents -> rounds half-up to 1 cent
      const price50: Money = { amountMinor: 50, currency: "USD" };
      expect(MoneyEngine.applyPercentageDiscount(price50, 100)).toEqual({
        amountMinor: 1,
        currency: "USD",
      });

      // 49 cents * 100 bps (1%) = 0.49 cents -> rounds down to 0 cents
      const price49: Money = { amountMinor: 49, currency: "USD" };
      expect(MoneyEngine.applyPercentageDiscount(price49, 100)).toEqual({
        amountMinor: 0,
        currency: "USD",
      });

      // 150 cents * 100 bps (1%) = 1.5 cents -> rounds half-up to 2 cents
      const price150: Money = { amountMinor: 150, currency: "USD" };
      expect(MoneyEngine.applyPercentageDiscount(price150, 100)).toEqual({
        amountMinor: 2,
        currency: "USD",
      });

      // 149 cents * 100 bps (1%) = 1.49 cents -> rounds down to 1 cent
      const price149: Money = { amountMinor: 149, currency: "USD" };
      expect(MoneyEngine.applyPercentageDiscount(price149, 100)).toEqual({
        amountMinor: 1,
        currency: "USD",
      });
    });

    it("should cap the discount at the subtotal amount", () => {
      const subtotal: Money = { amountMinor: 500, currency: "USD" };
      // Even if rounding or arithmetic slightly exceeded, Math.min caps at subtotal
      const discount = MoneyEngine.applyPercentageDiscount(subtotal, 10000);
      expect(discount.amountMinor).toBe(500);
    });

    it("should handle subtotal of zero", () => {
      const zeroSubtotal: Money = { amountMinor: 0, currency: "USD" };
      expect(MoneyEngine.applyPercentageDiscount(zeroSubtotal, 1500)).toEqual({
        amountMinor: 0,
        currency: "USD",
      });
    });

    it("should reject invalid basis points out of range [0, 10000]", () => {
      const subtotal: Money = { amountMinor: 1000, currency: "USD" };
      expect(() => MoneyEngine.applyPercentageDiscount(subtotal, -1)).toThrow(
        /Basis points must be between 0 and 10000/
      );
      expect(() => MoneyEngine.applyPercentageDiscount(subtotal, 10001)).toThrow(
        /Basis points must be between 0 and 10000/
      );
      expect(() => MoneyEngine.applyPercentageDiscount(subtotal, -500)).toThrow(
        /Basis points must be between 0 and 10000/
      );
    });
  });

  describe("5. Tax Calculations in Basis Points", () => {
    it("should calculate sales tax accurately with given basis points", () => {
      const taxableAmount: Money = { amountMinor: 10000, currency: "USD" }; // $100.00

      // 825 bps = 8.25% tax -> $8.25 (825 cents)
      expect(MoneyEngine.calculateTax(taxableAmount, 825)).toEqual({
        amountMinor: 825,
        currency: "USD",
      });

      // 500 bps = 5.00% tax -> $5.00 (500 cents)
      expect(MoneyEngine.calculateTax(taxableAmount, 500)).toEqual({
        amountMinor: 500,
        currency: "USD",
      });
    });

    it("should handle 0 bps tax rate (tax exempt)", () => {
      const taxableAmount: Money = { amountMinor: 4999, currency: "USD" };
      expect(MoneyEngine.calculateTax(taxableAmount, 0)).toEqual({
        amountMinor: 0,
        currency: "USD",
      });
    });

    it("should handle taxable amount of zero", () => {
      const zeroTaxable: Money = { amountMinor: 0, currency: "USD" };
      expect(MoneyEngine.calculateTax(zeroTaxable, 825)).toEqual({
        amountMinor: 0,
        currency: "USD",
      });
    });

    it("should round half-up on fractional tax cents", () => {
      // 1999 cents * 825 bps = 164.9175 cents -> rounds to 165 cents ($1.65)
      const taxableAmount: Money = { amountMinor: 1999, currency: "USD" };
      expect(MoneyEngine.calculateTax(taxableAmount, 825)).toEqual({
        amountMinor: 165,
        currency: "USD",
      });

      // 100 cents * 50 bps = 0.5 cents -> rounds half-up to 1 cent
      const amount100: Money = { amountMinor: 100, currency: "USD" };
      expect(MoneyEngine.calculateTax(amount100, 50)).toEqual({
        amountMinor: 1,
        currency: "USD",
      });

      // 98 cents * 50 bps = 0.49 cents -> rounds down to 0 cents
      const amount98: Money = { amountMinor: 98, currency: "USD" };
      expect(MoneyEngine.calculateTax(amount98, 50)).toEqual({
        amountMinor: 0,
        currency: "USD",
      });
    });

    it("should throw an error for negative tax rates", () => {
      const taxableAmount: Money = { amountMinor: 1000, currency: "USD" };
      expect(() => MoneyEngine.calculateTax(taxableAmount, -1)).toThrow(
        /Tax rate cannot be negative/
      );
      expect(() => MoneyEngine.calculateTax(taxableAmount, -825)).toThrow(
        /Tax rate cannot be negative/
      );
    });
  });

  describe("6. Currency Mismatch Assertions", () => {
    it("should throw error when attempting to add mismatched currencies", () => {
      const usd: Money = { amountMinor: 1000, currency: "USD" };
      const eur: Money = { amountMinor: 1000, currency: "EUR" };
      expect(() => MoneyEngine.add(usd, eur)).toThrow(
        /Currency mismatch: cannot operate on USD and EUR/
      );
    });

    it("should throw error when attempting to subtract mismatched currencies", () => {
      const usd: Money = { amountMinor: 5000, currency: "USD" };
      const gbp: Money = { amountMinor: 2000, currency: "GBP" };
      expect(() => MoneyEngine.subtract(usd, gbp)).toThrow(
        /Currency mismatch: cannot operate on USD and GBP/
      );
    });

    it("should support case-insensitive currency matching (e.g., 'usd' vs 'USD')", () => {
      const lowerUsd: Money = { amountMinor: 1000, currency: "usd" };
      const upperUsd: Money = { amountMinor: 500, currency: "USD" };
      expect(MoneyEngine.add(lowerUsd, upperUsd)).toEqual({
        amountMinor: 1500,
        currency: "usd",
      });
      expect(MoneyEngine.subtract(upperUsd, lowerUsd)).toEqual({
        amountMinor: 0,
        currency: "USD",
      });
    });
  });

  describe("7. Edge Cases & Composite Calculations", () => {
    it("should handle large monetary values without floating point distortion", () => {
      // 10 million dollars ($10,000,000.00 = 1,000,000,000 minor units)
      const tenMillion = MoneyEngine.fromDecimal(10000000);
      expect(tenMillion.amountMinor).toBe(1000000000);

      const multiplied = MoneyEngine.multiply(tenMillion, 5);
      expect(multiplied.amountMinor).toBe(5000000000);
      expect(MoneyEngine.toDecimal(multiplied)).toBe("50000000.00");
    });

    it("should accurately execute an end-to-end checkout pricing pipeline", () => {
      // Line Item 1: 2x $24.99 ($49.98)
      const item1Price = MoneyEngine.fromDecimal("24.99");
      const lineItem1 = MoneyEngine.multiply(item1Price, 2);
      expect(lineItem1.amountMinor).toBe(4998);

      // Line Item 2: 1x $15.50 ($15.50)
      const lineItem2 = MoneyEngine.fromDecimal("15.50");
      expect(lineItem2.amountMinor).toBe(1550);

      // Subtotal: $49.98 + $15.50 = $65.48 (6548 cents)
      const subtotal = MoneyEngine.add(lineItem1, lineItem2);
      expect(subtotal.amountMinor).toBe(6548);
      expect(MoneyEngine.toDecimal(subtotal)).toBe("65.48");

      // Promo Coupon: 15% discount (1500 bps)
      // 6548 * 1500 / 10000 = 982.2 -> 982 cents discount ($9.82)
      const discount = MoneyEngine.applyPercentageDiscount(subtotal, 1500);
      expect(discount.amountMinor).toBe(982);
      expect(MoneyEngine.toDecimal(discount)).toBe("9.82");

      // Subtotal after discount: 6548 - 982 = 5566 cents ($55.66)
      const discountedSubtotal = MoneyEngine.subtract(subtotal, discount);
      expect(discountedSubtotal.amountMinor).toBe(5566);
      expect(MoneyEngine.toDecimal(discountedSubtotal)).toBe("55.66");

      // Sales Tax: 8.875% NYC tax (888 bps rounded) -> 5566 * 888 / 10000 = 494.26 -> 494 cents ($4.94)
      const tax = MoneyEngine.calculateTax(discountedSubtotal, 888);
      expect(tax.amountMinor).toBe(494);
      expect(MoneyEngine.toDecimal(tax)).toBe("4.94");

      // Grand Total: $55.66 + $4.94 = $60.60 (6060 cents)
      const grandTotal = MoneyEngine.add(discountedSubtotal, tax);
      expect(grandTotal.amountMinor).toBe(6060);
      expect(MoneyEngine.toDecimal(grandTotal)).toBe("60.60");
      expect(MoneyEngine.format(grandTotal, "en-US")).toBe("$60.60");
    });
  });
});
