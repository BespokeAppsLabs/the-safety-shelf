import { v } from "convex/values";
import { internalQuery } from "../../_generated/server";
import { resolveViewer } from "../../lib/auth";

// Ownership gate for payments.syncFromGateway. Internal so it can only be
// reached from our own action, and it resolves the viewer itself rather than
// trusting a userId argument — auth propagates from the action.
//
// Returns false rather than throwing for an unknown reference: the caller
// answers with one indistinguishable "Unknown order", so this cannot be used
// to probe which references exist.
export const isOwnPendingOrder = internalQuery({
  args: { reference: v.string() },
  handler: async (ctx, { reference }) => {
    const viewer = await resolveViewer(ctx);
    const order = await ctx.db
      .query("orders")
      .withIndex("by_reference", (q) => q.eq("reference", reference))
      .unique();
    return order !== null && order.userId === viewer._id;
  },
});
