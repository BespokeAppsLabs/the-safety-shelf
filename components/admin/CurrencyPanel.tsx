"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { api } from "@/convex/_generated/api";
import { COUNTRY_CURRENCY } from "@/lib/languages";
import { convertToWholeUnits, formatWholeUnits } from "@/lib/pricing";

// Currencies the store's target markets actually use, deduped. Only a picklist
// — the rate itself is always the owner's number, stored in the database.
const SUGGESTED = [...new Set(Object.values(COUNTRY_CURRENCY))].sort();

// A representative catalogue price, purely so the owner can see what a rate
// does before saving it.
const PREVIEW_MINOR = 1499;

export function CurrencyPanel() {
  const settings = useQuery(api.storeSettings.get, {});
  const rates = useQuery(api.fxRates.list, {});
  const setBaseCurrency = useMutation(api.storeSettings.setBaseCurrency);
  const upsertRate = useMutation(api.fxRates.upsert);
  const removeRate = useMutation(api.fxRates.remove);

  const [base, setBase] = useState("");
  const [currency, setCurrency] = useState("");
  const [rate, setRate] = useState("");
  const [error, setError] = useState<string | null>(null);

  const baseCurrency = settings?.baseCurrency ?? null;

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="space-y-6">
      <Card className="space-y-4">
        <div>
          <p className="text-sm font-semibold text-ink">Base currency</p>
          <p className="mt-1 text-xs text-muted">
            The currency you type book prices in. Every other price on the store is converted from
            it. Changing this does not re-price the catalog — the numbers on your books stay as
            typed, so re-check them after switching.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Input
            value={base}
            placeholder={baseCurrency ?? "USD"}
            onChange={(e) => setBase(e.target.value)}
            className="max-w-40"
          />
          <Button
            disabled={!base.trim()}
            onClick={() => run(async () => {
              await setBaseCurrency({ baseCurrency: base });
              setBase("");
            })}
          >
            {baseCurrency ? "Change" : "Set"}
          </Button>
          {baseCurrency ? (
            <p className="text-sm text-muted">
              Currently <span className="font-semibold text-ink">{baseCurrency}</span>
            </p>
          ) : (
            <p className="text-sm font-semibold text-red-strong">
              Not set — the storefront cannot show any prices until you set this.
            </p>
          )}
        </div>
      </Card>

      <Card className="space-y-4">
        <div>
          <p className="text-sm font-semibold text-ink">Display rates</p>
          <p className="mt-1 text-xs text-muted">
            1 {baseCurrency ?? "base unit"} = the rate you enter. Shoppers see their country&apos;s
            currency, rounded to a whole amount with no cents. Currencies without a rate here fall
            back to {baseCurrency ?? "the base currency"}.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Currency</span>
            <Input
              list="suggested-currencies"
              value={currency}
              placeholder="EUR"
              onChange={(e) => setCurrency(e.target.value)}
              className="max-w-40"
            />
            <datalist id="suggested-currencies">
              {SUGGESTED.map((code) => <option key={code} value={code} />)}
            </datalist>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Rate</span>
            <Input
              value={rate}
              inputMode="decimal"
              placeholder="0.92"
              onChange={(e) => setRate(e.target.value)}
              className="max-w-40"
            />
          </label>
          <Button
            disabled={!currency.trim() || !Number.parseFloat(rate)}
            onClick={() => run(async () => {
              await upsertRate({ currency, rate: Number.parseFloat(rate) });
              setCurrency("");
              setRate("");
            })}
          >
            Save rate
          </Button>
        </div>

        {rates?.length ? (
          <ul className="divide-y divide-border">
            {rates.map((row) => (
              <li key={row._id} className="flex items-center justify-between gap-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-ink">
                    {row.currency} · {row.rate}
                  </p>
                  {/* The whole point of the panel: what a shopper actually sees. */}
                  <p className="text-xs text-muted">
                    {baseCurrency
                      ? `${formatWholeUnits(convertToWholeUnits(PREVIEW_MINOR, baseCurrency, 1), baseCurrency, "en")} → ${formatWholeUnits(convertToWholeUnits(PREVIEW_MINOR, baseCurrency, row.rate), row.currency, "en")}`
                      : "Set a base currency to preview"}
                  </p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => run(() => removeRate({ rateId: row._id }))}>
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No rates yet — everyone sees {baseCurrency ?? "base"} prices.</p>
        )}
      </Card>

      {error ? (
        <Card className="border-red-soft bg-red-soft/40">
          <p className="text-sm font-semibold text-red-strong">{error}</p>
        </Card>
      ) : null}
    </div>
  );
}
