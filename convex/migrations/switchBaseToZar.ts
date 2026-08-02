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

    // Seed the display rate the storefront needs to show USD, which is now the
    // default for shoppers we cannot place. Without it, every international
    // visitor silently falls back to reading rand. fxRates means
    // "1 base = rate × currency", so ZAR → USD is the reciprocal.
    const existing = await ctx.db
      .query("fxRates")
      .withIndex("by_currency", (q) => q.eq("currency", "USD"))
      .unique();
    const rate = 1 / usdToZar;
    if (existing) {
      await ctx.db.patch(existing._id, { rate, updatedAt: Date.now() });
    } else {
      await ctx.db.insert("fxRates", { currency: "USD", rate, updatedAt: Date.now() });
    }

    return { applied: true as const, changed: changes.length, books: changes };
  },
});
