// The store's price calculator. Every price the customer sees comes through
// here, and every input to it comes from the database: books.priceCents is the
// amount, storeSettings.baseCurrency is what that amount is denominated in, and
// fxRates supplies the display rate. Nothing here hardcodes a currency or an
// amount.
//
// Money is never stored in a display currency. Orders keep base-currency minor
// units, so editing a rate changes shop-window prices and never rewrites what
// past customers were charged.

/**
 * How many minor units make one major unit of `currency`, from the runtime's
 * own ISO data — 100 for USD/EUR, 1 for JPY/KRW. Deliberately not a lookup
 * table: a hand-maintained one silently prices JPY 100x wrong the day it drifts.
 */
export function minorUnitsPerMajor(currency: string): number {
  const { maximumFractionDigits } = new Intl.NumberFormat("en", {
    style: "currency",
    currency,
  }).resolvedOptions();
  return 10 ** (maximumFractionDigits ?? 2);
}

/**
 * Convert a base-currency amount in minor units to a whole-unit amount in
 * `currency`. No cents, ever — the result is a plain integer.
 *
 * Rounds to the nearest whole unit and never yields 0: a rate that would round
 * a real, positive price down to nothing would otherwise put a paid guide in
 * the window at "free".
 */
export function convertToWholeUnits(
  baseMinor: number,
  baseCurrency: string,
  rate: number,
): number {
  const major = baseMinor / minorUnitsPerMajor(baseCurrency);
  return Math.max(1, Math.round(major * rate));
}

/**
 * Format a whole-unit amount for display. `maximumFractionDigits: 0` is what
 * makes "no cents" true in the rendered string as well as in the arithmetic —
 * without it Intl would re-inflate 15 to "$15.00".
 */
export function formatWholeUnits(amount: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * The exact amount that will hit the card, to the minor unit.
 *
 * Distinct from formatWholeUnits on purpose. Shop-window prices are rounded to
 * whole units because a converted price is an approximation anyway, but the
 * charge is a real number the shopper can check against their statement —
 * rounding R149.99 to "R150" on a checkout screen would be a small lie about
 * a figure they can verify.
 */
export function formatExactAmount(minor: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(
    minor / minorUnitsPerMajor(currency),
  );
}

export type PriceQuote = { amount: number; currency: string; formatted: string };

/**
 * The one call a component makes. `rate` is undefined when the owner has not
 * set a rate for this currency — that is not an error, it just means the
 * shopper sees the base-currency price rather than an invented one.
 */
export function quotePrice(
  baseMinor: number,
  baseCurrency: string,
  locale: string,
  target?: { currency: string; rate: number },
): PriceQuote {
  const currency = target?.currency ?? baseCurrency;
  const rate = target?.rate ?? 1;
  const amount = convertToWholeUnits(baseMinor, baseCurrency, currency === baseCurrency ? 1 : rate);
  return { amount, currency, formatted: formatWholeUnits(amount, currency, locale) };
}
