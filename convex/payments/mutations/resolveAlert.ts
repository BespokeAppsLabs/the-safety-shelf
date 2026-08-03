import { ConvexError, v } from "convex/values";
import { viewerMutation, requireOwner } from "../../lib/auth";

/**
 * Dismiss a payment alert the owner has settled outside the app.
 *
 * Refunding through Paystack clears its own alert via the refund webhook, but
 * some flagged cases are resolved by other means — a mismatch traced to a
 * gateway quirk, a duplicate the customer agreed to keep. Without this the
 * dashboard accumulates handled alerts until nobody reads it, which is how a
 * real one gets missed.
 *
 * Dismissing stamps `alertResolvedAt` and leaves `failureReason` in place:
 * order status, amount and the reason for the alert are all untouched, so
 * clearing one never rewrites what happened. The audit trail outlives the
 * inbox-zero.
 */
export const resolveAlert = viewerMutation({
  args: { orderId: v.id("orders") },
  handler: async (ctx, { orderId }) => {
    requireOwner(ctx.viewer);
    const order = await ctx.db.get(orderId);
    if (!order) throw new ConvexError("Order not found");
    await ctx.db.patch(orderId, { alertResolvedAt: Date.now() });
  },
});
