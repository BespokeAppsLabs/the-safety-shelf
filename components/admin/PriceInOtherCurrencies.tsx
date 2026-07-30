"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { convertToWholeUnits, formatWholeUnits, minorUnitsPerMajor } from "@/lib/pricing";

/** The store's base currency code, so the price field is never labelled "USD" by assumption. */
export function BaseCurrencyCode() {
  const settings = useQuery(api.storeSettings.get, {});
  return <>{settings?.baseCurrency ?? "not set"}</>;
}

/**
 * Live conversion strip under the price field: type a price once and see what
 * every configured market pays. Uses the same calculator as the storefront, so
 * this preview cannot drift from what shoppers are quoted.
 */
export function PriceInOtherCurrencies({ priceMajor }: { priceMajor: string }) {
  const settings = useQuery(api.storeSettings.get, {});
  const rates = useQuery(api.fxRates.list, {});

  const base = settings?.baseCurrency;
  const parsed = Number.parseFloat(priceMajor);
  if (!base || !rates?.length || !Number.isFinite(parsed) || parsed <= 0) return null;

  const baseMinor = Math.round(parsed * minorUnitsPerMajor(base));

  return (
    <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
      {rates.map((row) => (
        <span key={row._id}>
          {formatWholeUnits(convertToWholeUnits(baseMinor, base, row.rate), row.currency, "en")}
        </span>
      ))}
    </p>
  );
}
