"use client";

import { useI18n } from "@/app/I18nProvider";
import { quotePrice } from "@/lib/pricing";

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
