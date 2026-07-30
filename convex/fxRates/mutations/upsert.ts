import { ConvexError, v } from "convex/values";
import { viewerMutation, requireOwner } from "../../lib/auth";
import { minorUnitsPerMajor } from "../../../lib/pricing";

// One display rate per currency: 1 unit of the base currency buys `rate` units
// of this one.
export const upsert = viewerMutation({
  args: { currency: v.string(), rate: v.number() },
  handler: async (ctx, { currency, rate }) => {
    requireOwner(ctx.viewer);

    const code = currency.trim().toUpperCase();
    try {
      minorUnitsPerMajor(code);
    } catch {
      throw new ConvexError(`"${currency}" is not a valid ISO currency code.`);
    }
    // A zero or negative rate would price the catalog at the floor of 1 unit
    // for every book rather than failing visibly.
    if (!(rate > 0) || !Number.isFinite(rate)) {
      throw new ConvexError("Rate must be a positive number.");
    }

    const existing = await ctx.db
      .query("fxRates")
      .withIndex("by_currency", (q) => q.eq("currency", code))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { rate, updatedAt: Date.now() });
      return existing._id;
    }
    return ctx.db.insert("fxRates", { currency: code, rate, updatedAt: Date.now() });
  },
});
