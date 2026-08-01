"use client";

import { useI18n } from "@/app/I18nProvider";
import { formatExactAmount, quotePrice } from "@/lib/pricing";

/**
 * The exact charge, in the currency the card is actually billed in — or null
 * when that is already what the shopper is looking at.
 *
 * Every price around the store is a converted approximation rounded to whole
 * units, but the shopper is charged base currency. Showing only the converted
 * figure at the moment of payment would mean the number on the button is not
 * the number on their statement, and they would have no way to reconcile the
 * difference. So checkout states both.
 */
export function useExactBillingText(cents: number): string | null {
  const { price, locale } = useI18n();
  const { baseCurrency, currency, rate } = price;

  // Nothing to disclose if they are already seeing base currency — either
  // because that is their currency, or because no rate exists so the store
  // never converted in the first place.
  if (!baseCurrency) return null;
  if (!currency || currency === baseCurrency || !rate) return null;

  return formatExactAmount(cents, baseCurrency, locale);
}

/**
 * Formatted price as a string, so it can be interpolated into a sentence
 * ("Buy for {price}") rather than concatenated after one. Word order differs
 * per language — Japanese and Arabic do not put the amount where English does —
 * so the price has to go through the dictionary placeholder, not around it.
 *
 * Returns null when the store has no configured base currency: the caller then
 * knows there is no price to render rather than receiving a guess.
 */
export function usePriceText(cents: number): string | null {
  return usePriceFormatter()(cents);
}

/**
 * Formatter for callers that must price many amounts, or price one inside a
 * loop or plain function where a hook cannot be called per item.
 */
export function usePriceFormatter(): (cents: number) => string | null {
  const { price, locale } = useI18n();
  const { baseCurrency, currency, rate } = price;

  return (cents: number) => {
    if (!baseCurrency) return null;
    return quotePrice(
      cents,
      baseCurrency,
      locale,
      currency && rate ? { currency, rate } : undefined,
    ).formatted;
  };
}

/**
 * Formatter that always reports the store's own currency, ignoring the viewer's.
 *
 * Admin surfaces use this, not the shopper-facing one: revenue is banked in base
 * currency, and a price the owner typed in base should read back in base. A
 * South African owner pricing in USD would otherwise see the catalog silently
 * converted to rand while editing dollar amounts.
 */
export function useBasePriceFormatter(): (cents: number) => string | null {
  const { price, locale } = useI18n();
  const { baseCurrency } = price;

  return (cents: number) => {
    if (!baseCurrency) return null;
    return quotePrice(cents, baseCurrency, locale).formatted;
  };
}

/** Base-currency price display for admin. See useBasePriceFormatter. */
export function BasePrice({ cents, className }: { cents: number; className?: string }) {
  const { dict } = useI18n();
  const text = useBasePriceFormatter()(cents);
  return <span className={className}>{text ?? dict.product.priceUnavailable}</span>;
}

/**
 * The only place a bare price reaches the screen. A client component so it works
 * unchanged inside both the server-rendered landing page and the client
 * storefront, and so there is exactly one path from books.priceCents to text.
 *
 * `cents` is minor units of the store's base currency — whatever the owner set
 * in Admin → Settings. It is never assumed to be dollars.
 */
export function Price({ cents, className }: { cents: number; className?: string }) {
  const { dict } = useI18n();
  const text = usePriceText(cents);
  return <span className={className}>{text ?? dict.product.priceUnavailable}</span>;
}
