// DEPLOY-ONCE MIGRATION — delete once every deployment has switched to ZAR.
//
// The store settles in ZAR, but the catalogue was priced in USD. `priceCents`
// is currency-agnostic minor units, so flipping storeSettings.baseCurrency on
// its own does NOT convert anything: a 1499 book stops meaning $14.99 and
// starts meaning R14.99 — roughly a 95% discount, applied silently. The price
// and the currency label have to move together, in one transaction.
//
// Run:
//   npx convex run migrations/switchBaseToZar:run '{"usdToZar": 18.5}'
//   npx convex run migrations/switchBaseToZar:run '{"usdToZar": 18.5, "apply": true}'
//
// `usdToZar` is a business input, deliberately not hardcoded or fetched: the
// rate baked into a catalogue is the owner's pricing decision, not whatever a
// rate API happened to return during a deploy.
import { v } from "convex/values";
import { internalMutation } from "../_generated/server";

/**
 * Prices a person would actually choose. Raw conversion produces R184.82, which
 * reads as an exchange-rate artefact rather than a price — and tells every
 * shopper the store thinks in dollars.
 *
 * This is a PRICING DECISION, not a conversion, and it rounds UP: the owner was
 * shown both this ladder and straight nearest-rand conversion, per book, and
 * chose the ladder ($9.99 → R199, $14.99 → R289, …). It is not the
 * nearest-whole-unit rule from docs/09-i18n-and-pricing.md, which governs
 * display conversion of a fixed base price — a shop-window approximation —
 * whereas this sets the base prices themselves. Do not "fix" it to round down.
 */
const PRICE_LADDER = [
  99, 129, 149, 169, 179, 199, 219, 229, 249, 269, 289, 299,
  329, 349, 379, 399, 449, 499, 549, 599, 699, 799, 899, 999,
];

/**
 * Round UP to the next ladder price, never down: rounding down would quietly
 * sell below the converted value, and doing that across a catalogue is a
 * discount nobody approved. Above the ladder, fall back to the next whole 50.
 */
function toLadderPrice(rand: number): number {
  const hit = PRICE_LADDER.find((p) => p >= rand);
  return hit ?? Math.ceil(rand / 50) * 50;
}

export const run = internalMutation({
  args: { usdToZar: v.number(), apply: v.optional(v.boolean()) },
  handler: async (ctx, { usdToZar, apply = false }) => {
    if (!(usdToZar > 0)) throw new Error("usdToZar must be a positive number.");

    const settings = await ctx.db.query("storeSettings").first();
    if (!settings) throw new Error("No storeSettings row — set a base currency first.");
    // Idempotency guard, and the reason this cannot be re-run by accident:
    // a second pass would convert already-converted prices again.
    if (settings.baseCurrency === "ZAR") {
      return { alreadyZar: true as const, changed: 0, books: [] };
    }
    // `usdToZar` is, by name and by arithmetic, a USD rate. Applying it to a
    // catalogue priced in anything else silently corrupts every price — a EUR
    // book would be multiplied by a dollar rate. Refuse rather than guess.
    if (settings.baseCurrency !== "USD") {
      throw new Error(
        `Base currency is ${settings.baseCurrency}, not USD. This migration only converts a USD catalogue.`,
      );
    }

    const books = await ctx.db.query("books").collect();
    const changes = books.map((book) => ({
      slug: book.slug,
      fromCents: book.priceCents,
      toCents: toLadderPrice((book.priceCents * usdToZar) / 100) * 100,
    }));

    if (!apply) return { dryRun: true as const, changed: changes.length, books: changes };

    for (const [i, book] of books.entries()) {
      await ctx.db.patch(book._id, { priceCents: changes[i].toCents });
    }
    await ctx.db.patch(settings._id, { baseCurrency: "ZAR" });

    // Every existing rate was written against the OLD base. fxRates means
    // "1 base = rate × currency", so a EUR row saying 0.92 meant "1 USD = 0.92
    // EUR"; left alone it would now claim "1 ZAR = 0.92 EUR" and misprice that
    // market by the whole exchange rate. Rebase them all in this transaction:
    // 1 ZAR = (1/usdToZar) USD, so every old per-USD rate divides through.
    const now = Date.now();
    const rates = await ctx.db.query("fxRates").collect();
    for (const row of rates) {
      await ctx.db.patch(row._id, { rate: row.rate / usdToZar, updatedAt: now });
    }

    // The storefront needs a USD rate specifically: USD is the default display
    // currency for shoppers we cannot place, and without it every international
    // visitor silently falls back to reading rand. A pre-existing USD row of
    // 1.0 has already been divided to the same value by the loop above.
    const usd = await ctx.db
      .query("fxRates")
      .withIndex("by_currency", (q) => q.eq("currency", "USD"))
      .unique();
    if (!usd) {
      await ctx.db.insert("fxRates", { currency: "USD", rate: 1 / usdToZar, updatedAt: now });
    }

    return { applied: true as const, changed: changes.length, books: changes, ratesRebased: rates.length };
  },
});
