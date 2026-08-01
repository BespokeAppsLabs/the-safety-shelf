import { describe, expect, it } from "vitest";
import { parseAcceptLanguage, resolveCurrency, resolveLanguage } from "../lib/locale";

describe("parseAcceptLanguage", () => {
  it("orders by quality and strips regions", () => {
    expect(parseAcceptLanguage("en;q=0.8,it-IT,it;q=0.9")).toEqual(["it", "it", "en"]);
  });

  it("treats a bare tag as q=1, outranking an explicit q=0.9", () => {
    expect(parseAcceptLanguage("ja,en;q=0.9")[0]).toBe("ja");
  });

  it("drops q=0 (explicitly not accepted)", () => {
    expect(parseAcceptLanguage("de;q=0,fr;q=0.5")).toEqual(["fr"]);
  });

  it("survives a missing or junk header", () => {
    expect(parseAcceptLanguage(null)).toEqual([]);
    expect(parseAcceptLanguage("")).toEqual([]);
  });
});

describe("resolveLanguage", () => {
  it("honours an explicit cookie above everything else", () => {
    expect(resolveLanguage({ cookie: "el", acceptLanguage: "ja", country: "JP" })).toBe("el");
  });

  it("ignores a cookie holding a language we do not ship", () => {
    expect(resolveLanguage({ cookie: "xx", acceptLanguage: "it-IT" })).toBe("it");
  });

  it("prefers the browser's language over the country's", () => {
    // The case geo-first detection gets wrong: an English reader in the UAE.
    expect(resolveLanguage({ acceptLanguage: "en-GB,en;q=0.9", country: "AE" })).toBe("en");
  });

  it("skips languages we do not ship and takes the next acceptable one", () => {
    expect(resolveLanguage({ acceptLanguage: "is-IS,is;q=0.9,ko;q=0.8" })).toBe("ko");
  });

  it("falls back to country when the browser says nothing useful", () => {
    expect(resolveLanguage({ acceptLanguage: null, country: "ID" })).toBe("id");
    expect(resolveLanguage({ acceptLanguage: "*", country: "SA" })).toBe("ar");
  });

  it("falls back to English for unmapped countries", () => {
    expect(resolveLanguage({ country: "IS" })).toBe("en");
    expect(resolveLanguage({})).toBe("en");
  });
});

describe("resolveCurrency", () => {
  it("keys off country, not language — Arabic is four currencies", () => {
    expect(resolveCurrency("EG")).toBe("EGP");
    expect(resolveCurrency("AE")).toBe("AED");
    expect(resolveCurrency("SA")).toBe("SAR");
    expect(resolveCurrency("LB")).toBe("LBP");
  });

  it("falls back to USD for unmapped countries rather than the base currency", () => {
    // Prices settle in rand, but an unplaceable international shopper shown
    // "R280" cannot judge it. USD is the unit most of the world prices against.
    expect(resolveCurrency("IS")).toBe("USD");
    expect(resolveCurrency(null)).toBe("USD");
    expect(resolveCurrency(undefined)).toBe("USD");
  });

  it("still prefers the shopper's own currency when the country is known", () => {
    expect(resolveCurrency("ZA")).toBe("ZAR");
    expect(resolveCurrency("jp")).toBe("JPY");
  });
});
