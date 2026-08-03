import { v } from "convex/values";
import { viewerQuery } from "../../lib/auth";

/**
 * The amount an already-open checkout will actually charge for this book.
 *
 * A pending order snapshots `totalCents` and `currency` when it is created, and
 * the Paystack session minted from it stays payable indefinitely — the account's
 * `payment_session_timeout` is 0. Clicking Buy again resumes that session rather
 * than minting a new one, so the charge is the snapshot, not today's price.
 *
 * Without this the storefront would disclose the *current* price while the
 * gateway collected the *snapshotted* one — and this PR ships a repricing
 * migration, so the two genuinely can differ. Returns null when there is no
 * open checkout, which is the ordinary case.
 */
export const pendingCheckout = viewerQuery({
  args: { bookId: v.id("books") },
  handler: async (ctx, { bookId }) => {
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_user", (q) => q.eq("userId", ctx.viewer._id))
      .collect();

    for (const order of orders) {
      if (order.status !== "pending") continue;
      const items = await ctx.db
        .query("orderItems")
        .withIndex("by_order", (q) => q.eq("orderId", order._id))
        .collect();
      if (items.some((item) => item.bookId === bookId)) {
        return { totalCents: order.totalCents, currency: order.currency };
      }
    }
    return null;
  },
});
