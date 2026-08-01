import { v } from "convex/values";
import { viewerQuery } from "../../lib/auth";

// Backs the post-checkout callback page. Convex queries are live, so the page
// re-renders the moment the webhook flips the order to "paid" — no polling.
//
// Scoped to the viewer's own orders: a reference is unguessable, but that is
// not an authorisation model.
export const orderStatus = viewerQuery({
  args: { reference: v.string() },
  handler: async (ctx, { reference }) => {
    const order = await ctx.db
      .query("orders")
      .withIndex("by_reference", (q) => q.eq("reference", reference))
      .unique();
    if (!order || order.userId !== ctx.viewer._id) return null;

    const items = await ctx.db
      .query("orderItems")
      .withIndex("by_order", (q) => q.eq("orderId", order._id))
      .collect();
    const book = items[0] ? await ctx.db.get(items[0].bookId) : null;

    return {
      status: order.status,
      failureReason: order.failureReason ?? null,
      bookSlug: book?.slug ?? null,
      bookTitle: book?.title ?? null,
    };
  },
});
