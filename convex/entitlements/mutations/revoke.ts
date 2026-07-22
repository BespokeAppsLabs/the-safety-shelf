import { ConvexError, v } from "convex/values";
import { viewerMutation, requireOwner } from "../../lib/auth";

// Manual/demo revoke path (refunds, chargebacks). Production wires this same
// shape to a Stripe `charge.refunded` webhook instead of an owner click.
export const revoke = viewerMutation({
  args: { userId: v.id("users"), bookId: v.id("books") },
  handler: async (ctx, { userId, bookId }) => {
    requireOwner(ctx.viewer);

    const entitlement = await ctx.db
      .query("entitlements")
      .withIndex("by_user_book", (q) => q.eq("userId", userId).eq("bookId", bookId))
      .unique();
    if (!entitlement || entitlement.revokedAt) throw new ConvexError("No active entitlement to revoke");

    await ctx.db.patch(entitlement._id, { revokedAt: Date.now() });
    await ctx.db.patch(entitlement.orderId, { status: "refunded" });
  },
});
