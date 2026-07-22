import { ConvexError, v } from "convex/values";
import { viewerMutation, requireOwner } from "../../lib/auth";
import { createPaidEntitlement } from "../lib";

// Manual/demo grant path (comps, testing) — owner-gated. Production checkout
// replaces the *caller* of this same order/entitlement shape with a Convex
// httpAction on Stripe's `checkout.session.completed` webhook.
export const grant = viewerMutation({
  args: { userId: v.id("users"), bookId: v.id("books") },
  handler: async (ctx, { userId, bookId }) => {
    requireOwner(ctx.viewer);

    const recipient = await ctx.db.get(userId);
    if (!recipient) throw new ConvexError("User not found");

    await createPaidEntitlement(ctx, { userId, bookId, sessionIdPrefix: "manual" });
  },
});
