import { v } from "convex/values";
import { internalMutation } from "../../_generated/server";

// Driven by Paystack's `charge.refunded` / `refund.processed` webhooks. Same
// shape as the owner-facing entitlements.revoke, just triggered by the gateway
// rather than a click — access checks treat a revoked entitlement as no access.
export const refund = internalMutation({
  args: { reference: v.string() },
  handler: async (ctx, { reference }) => {
    const order = await ctx.db
      .query("orders")
      .withIndex("by_reference", (q) => q.eq("reference", reference))
      .unique();
    if (!order) return { status: "unknown_reference" as const };
    if (order.status === "refunded") return { status: "already_refunded" as const };

    await ctx.db.patch(order._id, { status: "refunded" });

    // Revoke only the entitlements this order granted. A customer who
    // re-bought the same book on a later order still owns it, and that later
    // entitlement now points at the newer orderId.
    const items = await ctx.db
      .query("orderItems")
      .withIndex("by_order", (q) => q.eq("orderId", order._id))
      .collect();
    for (const item of items) {
      const entitlement = await ctx.db
        .query("entitlements")
        .withIndex("by_user_book", (q) => q.eq("userId", order.userId).eq("bookId", item.bookId))
        .unique();
      if (entitlement && entitlement.orderId === order._id && !entitlement.revokedAt) {
        await ctx.db.patch(entitlement._id, { revokedAt: Date.now() });
      }
    }

    return { status: "refunded" as const };
  },
});
