import { describe, expect, it } from "vitest";
import { convertToWholeUnits, formatWholeUnits, minorUnitsPerMajor, quotePrice, formatExactAmount } from "../lib/pricing";

describe("minorUnitsPerMajor", () => {
  it("reads decimals from ISO data, not a hand-kept table", () => {
    expect(minorUnitsPerMajor("USD")).toBe(100);
    expect(minorUnitsPerMajor("ZAR")).toBe(100);
    // Zero-decimal currencies: ¥1500 is 1500 minor units, not 150000.
    expect(minorUnitsPerMajor("JPY")).toBe(1);
    expect(minorUnitsPerMajor("KRW")).toBe(1);
  });
});

describe("convertToWholeUnits", () => {
  it("rounds to whole units — never cents", () => {
    // $14.99 at 0.92 EUR/USD -> 13.79 -> 14
    expect(convertToWholeUnits(1499, "USD", 0.92)).toBe(14);
    expect(Number.isInteger(convertToWholeUnits(1499, "USD", 0.92))).toBe(true);
  });

  it("converts from a zero-decimal base currency", () => {
    // ¥1500 is already 1500 major units.
    expect(convertToWholeUnits(1500, "JPY", 0.0064)).toBe(10);
  });

  it("never rounds a paid guide down to free", () => {
    // A tiny price against a strong currency would floor to 0 without a guard.
    expect(convertToWholeUnits(50, "USD", 0.9)).toBe(1);
  });

  it("is identity at rate 1", () => {
    expect(convertToWholeUnits(1499, "USD", 1)).toBe(15);
  });
});

describe("quotePrice", () => {
  it("falls back to base currency when the owner set no rate", () => {
    const quote = quotePrice(1499, "ZAR", "en-ZA");
    expect(quote.currency).toBe("ZAR");
    expect(quote.amount).toBe(15);
  });

  it("ignores a stale rate when target equals base", () => {
    const quote = quotePrice(1499, "USD", "en-US", { currency: "USD", rate: 0.5 });
    expect(quote.amount).toBe(15);
  });

  it("renders without cents", () => {
    expect(formatWholeUnits(14, "EUR", "de-DE")).not.toMatch(/[,.]\d\d$/);
    expect(quotePrice(1499, "USD", "ja-JP", { currency: "JPY", rate: 157 }).formatted)
      .not.toMatch(/[,.]\d\d$/);
  });
});

describe("formatExactAmount", () => {
  it("shows the real charge to the minor unit, unlike rounded shop-window prices", () => {
    // The shopper can check this against a bank statement, so R149.99 must not
    // render as "R150" the way a converted display price would.
    expect(formatExactAmount(14999, "ZAR", "en-ZA")).toMatch(/149[.,]99/);
    expect(formatWholeUnits(convertToWholeUnits(14999, "ZAR", 1), "ZAR", "en-ZA")).toMatch(/150/);
  });

  it("respects currencies with no minor unit", () => {
    expect(formatExactAmount(1500, "JPY", "en")).toMatch(/1,500/);
  });
});
