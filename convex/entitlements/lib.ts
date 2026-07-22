import { ConvexError } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

// Shared by entitlements.grant (owner comps) and entitlements.demoPurchase
// (self-serve, pre-Stripe). Production's Stripe webhook will perform this
// same order/orderItem/entitlement write, just triggered by the webhook
// instead of either of these callers.
export async function createPaidEntitlement(
  ctx: MutationCtx,
  { userId, bookId, sessionIdPrefix }: { userId: Id<"users">; bookId: Id<"books">; sessionIdPrefix: string },
) {
  const book = await ctx.db.get(bookId);
  if (!book || book.status !== "live") throw new ConvexError("Book not available");

  const existing = await ctx.db
    .query("entitlements")
    .withIndex("by_user_book", (q) => q.eq("userId", userId).eq("bookId", bookId))
    .unique();
  if (existing && !existing.revokedAt) throw new ConvexError("User already owns this book");

  const orderId = await ctx.db.insert("orders", {
    userId,
    stripeSessionId: `${sessionIdPrefix}:${userId}:${bookId}:${Date.now()}`,
    totalCents: book.priceCents,
    status: "paid",
  });
  await ctx.db.insert("orderItems", { orderId, bookId, priceCents: book.priceCents });

  if (existing) {
    await ctx.db.patch(existing._id, { orderId, grantedAt: Date.now(), revokedAt: undefined });
  } else {
    await ctx.db.insert("entitlements", { userId, bookId, orderId, grantedAt: Date.now() });
  }
}
