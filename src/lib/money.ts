/**
 * Money Utility & Calculation Engine
 * Complies with PRD Section 7.2 (FR-PRICE-001, FR-PRICE-002) and ADR-003.
 *
 * Rules:
 * - NEVER use floating point math for money.
 * - Store all amounts as integer minor units (e.g. cents).
 * - All monetary calculations round half-up to integer cents.
 */

export interface Money {
  amountMinor: number; // Integer minor units (e.g., 1999 for $19.99)
  currency: string;    // ISO 4217 currency code (e.g., "USD")
}

export class MoneyEngine {
  /**
   * Convert human decimal string or number to integer minor units.
   * e.g. "19.99" -> 1999
   */
  static fromDecimal(amount: number | string, currency: string = "USD"): Money {
    const numeric = typeof amount === "string" ? parseFloat(amount) : amount;
    if (isNaN(numeric) || !isFinite(numeric)) {
      throw new Error(`Invalid monetary amount: ${amount}`);
    }
    // Round using exponential notation to avoid classic floating-point arithmetic artifacts
    const amountMinor = Math.round(Number(numeric + "e+2"));
    return { amountMinor, currency: currency.toUpperCase() };
  }

  /**
   * Convert minor units to formatted decimal string.
   * e.g. 1999 -> "19.99"
   */
  static toDecimal(money: Money): string {
    return (money.amountMinor / 100).toFixed(2);
  }

  /**
   * Format money for localized customer display.
   * e.g. 1999 -> "$19.99"
   */
  static format(money: Money, locale: string = "en-US"): string {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: money.currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(money.amountMinor / 100);
  }

  /**
   * Add two money instances (must share currency).
   */
  static add(a: Money, b: Money): Money {
    this.assertMatchingCurrency(a, b);
    return {
      amountMinor: a.amountMinor + b.amountMinor,
      currency: a.currency,
    };
  }

  /**
   * Subtract money (a - b). Result cannot be negative if allowNegative is false.
   */
  static subtract(a: Money, b: Money, allowNegative: boolean = false): Money {
    this.assertMatchingCurrency(a, b);
    const diff = a.amountMinor - b.amountMinor;
    if (!allowNegative && diff < 0) {
      return { amountMinor: 0, currency: a.currency };
    }
    return { amountMinor: diff, currency: a.currency };
  }

  /**
   * Multiply money by quantity.
   */
  static multiply(money: Money, quantity: number): Money {
    if (quantity < 0 || !Number.isInteger(quantity)) {
      throw new Error(`Quantity must be a positive integer, got: ${quantity}`);
    }
    return {
      amountMinor: money.amountMinor * quantity,
      currency: money.currency,
    };
  }

  /**
   * Apply percentage discount expressed in basis points (100 bps = 1%, 1000 bps = 10%).
   */
  static applyPercentageDiscount(subtotal: Money, basisPoints: number): Money {
    if (basisPoints < 0 || basisPoints > 10000) {
      throw new Error(`Basis points must be between 0 and 10000, got: ${basisPoints}`);
    }
    const discountAmount = Math.round((subtotal.amountMinor * basisPoints) / 10000);
    return {
      amountMinor: Math.min(discountAmount, subtotal.amountMinor),
      currency: subtotal.currency,
    };
  }

  /**
   * Calculate tax on a taxable amount given tax rate in basis points (e.g. 825 bps = 8.25%).
   */
  static calculateTax(taxableAmount: Money, taxRateBps: number): Money {
    if (taxRateBps < 0) {
      throw new Error(`Tax rate cannot be negative, got: ${taxRateBps}`);
    }
    const taxMinor = Math.round((taxableAmount.amountMinor * taxRateBps) / 10000);
    return {
      amountMinor: taxMinor,
      currency: taxableAmount.currency,
    };
  }

  private static assertMatchingCurrency(a: Money, b: Money): void {
    if (a.currency.toUpperCase() !== b.currency.toUpperCase()) {
      throw new Error(`Currency mismatch: cannot operate on ${a.currency} and ${b.currency}`);
    }
  }
}
