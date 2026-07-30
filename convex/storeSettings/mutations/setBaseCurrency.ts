import { ConvexError, v } from "convex/values";
import { viewerMutation, requireOwner } from "../../lib/auth";
import { minorUnitsPerMajor } from "../../../lib/pricing";

// Singleton upsert. Changing the base currency does NOT re-denominate existing
// books — priceCents values stay as typed, so the owner is re-pricing the
// catalog when they switch. The UI warns; this guard only rejects codes the
// runtime cannot format.
export const setBaseCurrency = viewerMutation({
  args: { baseCurrency: v.string() },
  handler: async (ctx, { baseCurrency }) => {
    requireOwner(ctx.viewer);

    const code = baseCurrency.trim().toUpperCase();
    // Intl throws RangeError on a non-ISO-4217 code — cheaper and more current
    // than shipping our own list of valid currencies.
    try {
      minorUnitsPerMajor(code);
    } catch {
      throw new ConvexError(`"${baseCurrency}" is not a valid ISO currency code.`);
    }

    const existing = await ctx.db.query("storeSettings").first();
    if (existing) {
      await ctx.db.patch(existing._id, { baseCurrency: code });
      return existing._id;
    }
    return ctx.db.insert("storeSettings", { baseCurrency: code });
  },
});
