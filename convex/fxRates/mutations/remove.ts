import { v } from "convex/values";
import { viewerMutation, requireOwner } from "../../lib/auth";

// Dropping a rate is how the owner stops offering a currency: the storefront
// falls back to showing base-currency prices for those shoppers.
export const remove = viewerMutation({
  args: { rateId: v.id("fxRates") },
  handler: async (ctx, { rateId }) => {
    requireOwner(ctx.viewer);
    await ctx.db.delete(rateId);
  },
});
