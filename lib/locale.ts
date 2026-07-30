// Locale resolution. Pure functions so the detection chain is testable without
// booting a request — proxy.ts is only the plumbing that feeds these headers in.
import {
  COUNTRY_CURRENCY,
  COUNTRY_LANGUAGE,
  DEFAULT_LANGUAGE,
  isLanguageCode,
  type LanguageCode,
} from "./languages";

export const LOCALE_COOKIE = "locale";

/**
 * Accept-Language, best-quality-first, reduced to base language codes.
 * `fr-CA` and `fr` both mean "show French" here — the store has one French
 * dictionary, not a Quebec one.
 */
export function parseAcceptLanguage(header: string | null | undefined): string[] {
  if (!header) return [];
  return header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params
        .map((p) => p.trim())
        .find((p) => p.startsWith("q="));
      // A tag with no q= is q=1 by spec, which must outrank an explicit q=0.9.
      const quality = q ? Number.parseFloat(q.slice(2)) : 1;
      return { tag: tag.trim().toLowerCase(), quality: Number.isFinite(quality) ? quality : 0 };
    })
    .filter((entry) => entry.tag && entry.quality > 0)
    .sort((a, b) => b.quality - a.quality)
    .map((entry) => entry.tag.split("-")[0]);
}

/**
 * The detection chain, in priority order:
 *
 *   1. an explicit choice the shopper already made (cookie)
 *   2. Accept-Language — what their browser says they actually read
 *   3. the country their IP resolves to
 *   4. English
 *
 * Accept-Language outranks geography on purpose. Region is a poor proxy for
 * language in exactly this store's markets: an English speaker in Dubai, an
 * expat in Mumbai, and a Malaysian who reads English all get served wrongly by
 * a geo-first chain. Geography only breaks ties the browser left open.
 */
export function resolveLanguage(input: {
  cookie?: string | null;
  acceptLanguage?: string | null;
  country?: string | null;
}): LanguageCode {
  if (input.cookie && isLanguageCode(input.cookie)) return input.cookie;

  for (const candidate of parseAcceptLanguage(input.acceptLanguage)) {
    if (isLanguageCode(candidate)) return candidate;
  }

  const country = input.country?.toUpperCase();
  if (country && COUNTRY_LANGUAGE[country]) return COUNTRY_LANGUAGE[country];

  return DEFAULT_LANGUAGE;
}

/**
 * Display currency for a shopper's country. Undefined means "we have no
 * mapping" — callers fall back to the store's base currency rather than
 * inventing one.
 */
export function resolveCurrency(country: string | null | undefined): string | undefined {
  if (!country) return undefined;
  return COUNTRY_CURRENCY[country.toUpperCase()];
}
