import { v } from "convex/values";
import { viewerInternalMutation } from "../../lib/auth";
import { assertPurchasable, requireBaseCurrency } from "../../entitlements/lib";

// Reserves an order before the shopper is sent to Paystack. Runs every guard
// that must hold BEFORE money moves, inside a transaction, so two concurrent
// tabs cannot both open a checkout for a book the customer already owns.
//
// Writes the orderItems line here rather than at reconcile time: the line item
// is what was put in the basket, not what was granted. Sales figures stay
// correct because every reader goes through lib/sales.paidOrderItems, which
// ignores lines belonging to pending or refunded orders.
//
// Grants nothing. Access is handed over only by payments.reconcile, driven by
// the signed webhook.
export const createPendingOrder = viewerInternalMutation({
  args: { bookId: v.id("books"), reference: v.string() },
  handler: async (ctx, { bookId, reference }) => {
    const userId = ctx.viewer._id;
    const book = await assertPurchasable(ctx, userId, bookId);
    const currency = await requireBaseCurrency(ctx);

    const orderId = await ctx.db.insert("orders", {
      userId,
      reference,
      // Charged verbatim in the store's base currency. The localised price the
      // shopper saw is display only (docs/09-i18n-and-pricing.md) — the ledger
      // never moves, so an FX-rate edit cannot restate this amount.
      totalCents: book.priceCents,
      currency,
      status: "pending",
    });
    await ctx.db.insert("orderItems", { orderId, bookId, priceCents: book.priceCents });

    return { orderId, amount: book.priceCents, currency, email: ctx.viewer.email };
  },
});
