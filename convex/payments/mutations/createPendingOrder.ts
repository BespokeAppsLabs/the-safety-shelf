import { v } from "convex/values";
import { viewerInternalMutation } from "../../lib/auth";
import { assertPurchasable, requireBaseCurrency } from "../../entitlements/lib";

// Reserves an order before the shopper is sent to Paystack, and is the gate
// that stops a customer being charged twice for one book.
//
// Two tabs used to be able to open two Paystack transactions: the only guard
// was "does an entitlement already exist", which is still false at that point
// in both tabs. Both could settle, producing two paid orders and two charges
// against one repointed entitlement. Refusing the second grant afterwards does
// not help — the money has already moved. So a second transaction is never
// created: the pending order row IS the lock, and a later attempt resumes the
// existing checkout instead of opening a rival one.
//
// Deliberately NOT time-based. Paystack sessions never expire by default
// (payment_session_timeout is an integration-level setting that defaults to 0),
// so a "stale after N minutes" rule would release the lock while the original
// session was still payable — the exact double-charge window it was meant to
// close. Release is by verified outcome instead; see actions/startCheckout.
//
// Returns a mode rather than a URL because the authorization_url does not exist
// yet at this point — only Paystack can mint it, and only the creator may ask.

/**
 * How long a follower defers to the tab that created the order before taking
 * over.
 *
 * This is a takeover grace period, NOT proof the creator is dead — a Convex
 * action can outlive it, and Paystack mints a real, payable authorization_url
 * whether or not we ever store it. So a taken-over creator may still be
 * mid-flight holding a live URL.
 *
 * What makes takeover safe is not this timer but the publication fence in
 * attachAuthorizationUrl: a creator whose order is no longer pending cannot
 * publish, and startCheckout refuses to hand out a URL it could not publish.
 * The timer only decides when someone else may try.
 */
const PREPARING_LEASE_MS = 60 * 1000;
export const createPendingOrder = viewerInternalMutation({
  args: { bookId: v.id("books"), reference: v.string() },
  handler: async (ctx, { bookId, reference }) => {
    const userId = ctx.viewer._id;
    const book = await assertPurchasable(ctx, userId, bookId);
    const currency = await requireBaseCurrency(ctx);

    const orders = await ctx.db
      .query("orders")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    for (const order of orders) {
      if (order.status !== "pending") continue;
      const items = await ctx.db
        .query("orderItems")
        .withIndex("by_order", (q) => q.eq("orderId", order._id))
        .collect();
      if (!items.some((item) => item.bookId === bookId)) continue;

      // A checkout is already open for this book.
      if (order.authorizationUrl) {
        return {
          mode: "resume" as const,
          reference: order.reference,
          authorizationUrl: order.authorizationUrl,
        };
      }
      // No URL yet: the creator is between inserting this row and patching the
      // URL onto it. Normally sub-second, so a follower is told to retry rather
      // than being allowed to initialize a second, rival transaction.
      if (Date.now() - order._creationTime < PREPARING_LEASE_MS) {
        return { mode: "preparing" as const };
      }
      // Past the grace period, let this caller take over. Without a takeover
      // the order would say "preparing" forever if the creator died between
      // inserting the row and attaching a URL, permanently blocking the
      // customer from buying.
      //
      // Retiring the row here is what fences the old creator out: from this
      // point attachAuthorizationUrl will refuse to publish for it, so even if
      // it is still alive and Paystack hands it a live URL, that URL is never
      // given to a shopper. Both halves are required — the takeover alone
      // would leave two payable sessions.
      await ctx.db.patch(order._id, { status: "abandoned", failureReason: "initialize_incomplete" });
    }

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

    return {
      mode: "created" as const,
      orderId,
      reference,
      amount: book.priceCents,
      currency,
      email: ctx.viewer.email,
    };
  },
});

/**
 * Publication fence. Stores the hosted-checkout URL so a later attempt resumes
 * instead of rivalling — and reports whether it was allowed to.
 *
 * Returns false when this order is no longer pending, which means another tab
 * took over after the grace period. The caller MUST NOT hand its URL to a
 * shopper in that case: Paystack has minted a real, payable session for it, and
 * releasing that alongside the takeover's session is precisely the double
 * charge the whole design prevents. Mutations are transactional, so the
 * read-and-patch here cannot interleave with the takeover.
 */
export const attachAuthorizationUrl = viewerInternalMutation({
  args: { reference: v.string(), authorizationUrl: v.string() },
  handler: async (ctx, { reference, authorizationUrl }) => {
    const order = await ctx.db
      .query("orders")
      .withIndex("by_reference", (q) => q.eq("reference", reference))
      .unique();
    if (!order || order.userId !== ctx.viewer._id || order.status !== "pending") return false;
    await ctx.db.patch(order._id, { authorizationUrl });
    return true;
  },
});

/**
 * Retire a checkout that will never be paid — the gateway rejected
 * initialization, or verification proved the session failed or was abandoned.
 * This is what releases the lock, and it is driven by a verified outcome rather
 * than by a webhook: a shopper who closes the tab before processing generates
 * no Paystack event at all, so webhook-only terminality would strand the order.
 */
export const abandonOrder = viewerInternalMutation({
  args: { reference: v.string(), reason: v.string() },
  handler: async (ctx, { reference, reason }) => {
    const order = await ctx.db
      .query("orders")
      .withIndex("by_reference", (q) => q.eq("reference", reference))
      .unique();
    // Only ever retire the caller's own still-pending order — never touch one
    // the gateway may already have confirmed.
    if (!order || order.userId !== ctx.viewer._id || order.status !== "pending") return;
    await ctx.db.patch(order._id, { status: "abandoned", failureReason: reason });
  },
});
