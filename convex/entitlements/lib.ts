import { ConvexError } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

// Two halves of a purchase, deliberately separate because the paid path now
// straddles a network round-trip: payments.createPendingOrder runs the guards
// and records the line items BEFORE sending the shopper to Paystack, and
// payments.reconcile hands over access AFTER the signed webhook confirms the
// money. The owner comp path (entitlements.grant) runs both back to back.
//
// Keeping the guards in one shared function is what stops the two paths from
// drifting — a check added to only one of them is a hole in the other.

/**
 * Everything that must be true before we take someone's money. Returns the
 * book so callers get the price without a second read.
 */
export async function assertPurchasable(
  ctx: MutationCtx,
  userId: Id<"users">,
  bookId: Id<"books">,
) {
  const book = await ctx.db.get(bookId);
  if (!book || book.status !== "live") throw new ConvexError("Book not available");

  const existing = await ctx.db
    .query("entitlements")
    .withIndex("by_user_book", (q) => q.eq("userId", userId).eq("bookId", bookId))
    .unique();
  if (existing && !existing.revokedAt) throw new ConvexError("User already owns this book");

  return book;
}

/**
 * Hand over access. Called only once the order is known to be paid.
 * The orderItems line was already written when the order was created — this
 * grants the reading right, nothing else.
 */
export async function grantEntitlement(
  ctx: MutationCtx,
  { userId, bookId, orderId }: { userId: Id<"users">; bookId: Id<"books">; orderId: Id<"orders"> },
) {
  const existing = await ctx.db
    .query("entitlements")
    .withIndex("by_user_book", (q) => q.eq("userId", userId).eq("bookId", bookId))
    .unique();

  if (existing) {
    // Re-purchase after a refund: reuse the row so by_user_book stays unique.
    await ctx.db.patch(existing._id, { orderId, grantedAt: Date.now(), revokedAt: undefined });
  } else {
    await ctx.db.insert("entitlements", { userId, bookId, orderId, grantedAt: Date.now() });
  }
}

/** The store's base currency, or a visible failure. Never guesses. */
export async function requireBaseCurrency(ctx: MutationCtx): Promise<string> {
  const settings = await ctx.db.query("storeSettings").first();
  if (!settings) {
    throw new ConvexError("No base currency set — set one in Admin → Settings before selling.");
  }
  return settings.baseCurrency;
}
