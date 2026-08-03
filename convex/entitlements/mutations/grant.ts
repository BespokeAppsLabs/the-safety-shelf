import { ConvexError, v } from "convex/values";
import { viewerMutation, requireOwner } from "../../lib/auth";
import { assertPurchasable, grantEntitlement, requireBaseCurrency } from "../lib";

// Owner comp path (freebies, testing, support fixes) — owner-gated. No money
// moves, so it writes its own `comp:` order inline rather than going through
// Paystack. It runs the same guards and the same grant as the paid path
// (convex/payments) so the two cannot drift apart.
export const grant = viewerMutation({
  args: { userId: v.id("users"), bookId: v.id("books") },
  handler: async (ctx, { userId, bookId }) => {
    requireOwner(ctx.viewer);

    const recipient = await ctx.db.get(userId);
    if (!recipient) throw new ConvexError("User not found");

    const book = await assertPurchasable(ctx, userId, bookId);
    const currency = await requireBaseCurrency(ctx);

    const orderId = await ctx.db.insert("orders", {
      userId,
      reference: `comp:${userId}:${bookId}:${Date.now()}`,
      // The list price is recorded for the audit trail, but status "comp" keeps
      // it out of revenue and units sold. Writing these as "paid" reported
      // giveaways as income.
      totalCents: book.priceCents,
      currency,
      status: "comp",
    });

    await ctx.db.insert("orderItems", { orderId, bookId, priceCents: book.priceCents });
    await grantEntitlement(ctx, { userId, bookId, orderId });
  },
});
