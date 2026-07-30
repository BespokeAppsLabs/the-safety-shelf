"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Dictionary } from "@/lib/i18n";

// One context for everything locale-shaped: the strings, the text direction,
// and the money settings. Resolved once per request in the root layout and
// pushed down, so no component re-derives the locale or re-queries rates.
export type PriceSettings = {
  /** Currency books are priced in. Null until the owner configures the store. */
  baseCurrency: string | null;
  /** The shopper's display currency, if their country maps to one. */
  currency?: string;
  /** Base → display rate. Absent when the owner has not set one. */
  rate?: number;
};

export type I18nValue = {
  lang: string;
  dir: "ltr" | "rtl";
  /** BCP-47 tag for Intl formatting — number grouping differs from language. */
  locale: string;
  dict: Dictionary;
  price: PriceSettings;
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ value, children }: { value: I18nValue; children: ReactNode }) {
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside I18nProvider");
  return value;
}

/** Shorthand for the common case of only needing strings. */
export function useDict(): Dictionary {
  return useI18n().dict;
}
