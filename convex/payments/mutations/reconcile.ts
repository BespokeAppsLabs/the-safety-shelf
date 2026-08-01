import { v } from "convex/values";
import { internalMutation } from "../../_generated/server";
import { grantEntitlement } from "../../entitlements/lib";

// The ONLY place a paid entitlement is created. Reached from the signed
// Paystack webhook (convex/http.ts) and from payments.syncFromGateway, which
// re-verifies against Paystack when the shopper's browser beats the webhook
// home. Both routes are safe to run repeatedly.
export const reconcile = internalMutation({
  args: {
    reference: v.string(),
    outcome: v.union(v.literal("success"), v.literal("failed")),
    amount: v.optional(v.number()),
    currency: v.optional(v.string()),
    providerTransactionId: v.optional(v.string()),
    failureReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db
      .query("orders")
      .withIndex("by_reference", (q) => q.eq("reference", args.reference))
      .unique();

    // A reference we never issued — e.g. another environment sharing the same
    // Paystack account. Nothing to do; the caller still answers 200 so
    // Paystack stops retrying.
    if (!order) return { status: "unknown_reference" as const };

    // Idempotency. Paystack retries webhooks, and syncFromGateway can race
    // one. Granting twice would hand out a second entitlement row and, worse,
    // make the order look like two sales.
    if (order.status === "paid") return { status: "already_paid" as const };
    if (order.status === "refunded") return { status: "refunded" as const };

    if (args.outcome === "failed") {
      await ctx.db.patch(order._id, { failureReason: args.failureReason ?? "declined" });
      return { status: "failed" as const };
    }

    // Defence in depth. The webhook is signed, but never grant access off an
    // amount or currency that disagrees with what we recorded at initiation.
    if (args.amount !== undefined && args.amount !== order.totalCents) {
      await ctx.db.patch(order._id, { failureReason: "amount_mismatch" });
      return { status: "amount_mismatch" as const };
    }
    if (args.currency !== undefined && args.currency !== order.currency) {
      await ctx.db.patch(order._id, { failureReason: "currency_mismatch" });
      return { status: "currency_mismatch" as const };
    }

    await ctx.db.patch(order._id, {
      status: "paid",
      providerTransactionId: args.providerTransactionId,
      failureReason: undefined,
    });

    const items = await ctx.db
      .query("orderItems")
      .withIndex("by_order", (q) => q.eq("orderId", order._id))
      .collect();
    for (const item of items) {
      await grantEntitlement(ctx, { userId: order.userId, bookId: item.bookId, orderId: order._id });
    }

    return { status: "paid" as const };
  },
});
