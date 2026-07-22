import { v } from "convex/values";
import { viewerQuery } from "../../lib/auth";

// Access check for /read/[slug] and downloads. A revoked entitlement (refund)
// counts as not-owned, same as no entitlement at all.
export const isOwned = viewerQuery({
  args: { bookId: v.id("books") },
  handler: async (ctx, { bookId }) => {
    const entitlement = await ctx.db
      .query("entitlements")
      .withIndex("by_user_book", (q) => q.eq("userId", ctx.viewer._id).eq("bookId", bookId))
      .unique();
    return entitlement !== null && !entitlement.revokedAt;
  },
});
