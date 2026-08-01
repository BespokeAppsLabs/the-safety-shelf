// Default Convex runtime on purpose — the Paystack client needs only `fetch`
// and Web Crypto, and "use node" would buy nothing but slower cold starts.
import { ConvexError, v } from "convex/values";
import { action, type ActionCtx } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { initializeTransaction, verifyTransaction, PaystackError } from "../../lib/paystack/client";
import type { Id } from "../../_generated/dataModel";

type CheckoutResult = { authorizationUrl: string; reference: string } | { alreadyPaid: true };

/**
 * Opens a Paystack hosted checkout for one book and returns the URL to send
 * the shopper to. Grants nothing — the signed webhook does that.
 *
 * Exactly one live transaction can exist per (customer, book): a second click
 * resumes the first rather than creating a rival that could charge twice.
 */
export const startCheckout = action({
  args: { bookId: v.id("books") },
  handler: async (ctx, { bookId }): Promise<CheckoutResult> => {
    const appUrl = process.env.APP_URL;
    if (!appUrl) {
      throw new ConvexError(
        "APP_URL is not set on the Convex deployment. Run: npx convex env set APP_URL <url>",
      );
    }

    // Refuse to sell rather than sell on the wrong terms. Without a split code
    // Paystack happily processes an UNSPLIT transaction — the money all lands
    // in the main account and the 45% owed to the client silently never moves.
    // A payment that quietly breaks the revenue agreement is worse than a
    // checkout that fails loudly.
    const splitCode = process.env.PAYSTACK_SPLIT_CODE;
    if (!splitCode) {
      throw new ConvexError(
        "PAYSTACK_SPLIT_CODE is not set on the Convex deployment. Run: npx convex env set PAYSTACK_SPLIT_CODE <code>",
      );
    }

    const opened = await open(ctx, bookId, appUrl, splitCode);
    if (opened) return opened;

    // The existing checkout proved dead and was retired; open a fresh one. One
    // retry only — a second failure is a real fault, not a stale session.
    const retried = await open(ctx, bookId, appUrl, splitCode);
    if (retried) return retried;
    throw new ConvexError("Could not open checkout. Please try again.");
  },
});

/**
 * One attempt. Returns null when it retired a dead session and the caller
 * should try again from scratch.
 */
async function open(
  ctx: ActionCtx,
  bookId: Id<"books">,
  appUrl: string,
  splitCode: string,
): Promise<CheckoutResult | null> {
  // Opaque and unguessable. Generated here so the order row and the Paystack
  // transaction agree on it from the very first write.
  const reference = `TSS-${crypto.randomUUID()}`;

  // Auth propagates through runMutation, so the guards run as this viewer.
  const order = await ctx.runMutation(internal.payments.createPendingOrder, { bookId, reference });

  if (order.mode === "preparing") {
    throw new ConvexError("Your checkout is being prepared. Please try again in a moment.");
  }

  if (order.mode === "resume") {
    // Verify before resuming. This is the release path, and it deliberately
    // does not depend on a webhook: a shopper who abandons the hosted page
    // before processing generates no Paystack event at all, so waiting for one
    // would strand this order — and with it the customer's ability to buy —
    // indefinitely. Verify is authoritative and always available.
    let tx;
    try {
      tx = (await verifyTransaction(order.reference)).data;
    } catch {
      // Gateway unreachable: hand back the existing session rather than
      // opening a rival one we cannot rule out double-charging.
      return { authorizationUrl: order.authorizationUrl, reference: order.reference };
    }
    const status = tx.status;

    if (status === "success") {
      // Paid while we were not looking. Pass the verified amount and currency
      // through — reconcile refuses to grant without them, so omitting them
      // here would silently fail verification and then send the customer to a
      // reader they have no entitlement for.
      const settled = await ctx.runMutation(internal.payments.reconcile, {
        reference: order.reference,
        outcome: "success",
        amount: tx.amount,
        currency: tx.currency,
        providerTransactionId: tx.id != null ? String(tx.id) : undefined,
      });
      // Only claim it is paid if reconcile actually granted. A mismatch or a
      // duplicate leaves them on the checkout rather than in a book they do
      // not own.
      if (settled.status === "paid" || settled.status === "already_paid") return { alreadyPaid: true };
      // Verify says the money moved but reconcile refused to grant — a
      // mismatch, or a duplicate charge. Returning the checkout URL would be
      // absurd: that session is already complete and cannot remediate either
      // problem. Stop, and let the operator alert this raised do its job.
      throw new ConvexError(
        "This payment needs review before your guide can be unlocked. Our team has been notified.",
      );
    }
    if (status === "failed" || status === "reversed") {
      // Proven dead: the money definitively did not and will not move on this
      // transaction, so replacing it cannot double-charge.
      await ctx.runMutation(internal.payments.abandonOrder, {
        reference: order.reference,
        reason: `verified_${status}`,
      });
      return null; // caller opens a fresh checkout
    }
    // Everything else — including "abandoned" — resumes the SAME session.
    //
    // "abandoned" is the subtle one. It means the customer never began paying,
    // NOT that the checkout URL is dead: with payment_session_timeout at its
    // default of 0 that URL never expires and stays payable indefinitely.
    // Retiring it and minting a replacement would put two live, payable
    // transactions on one book — the double charge this whole design exists to
    // prevent. Only a status that proves the old transaction can never take
    // money is safe to replace.
    return { authorizationUrl: order.authorizationUrl, reference: order.reference };
  }

  try {
    const res = await initializeTransaction({
      email: order.email,
      amount: order.amount,
      currency: order.currency,
      reference,
      // Fixed server-side, never taken from the client — a caller-supplied
      // return URL is an open redirect.
      callback_url: `${appUrl}/payments/callback`,
      // The 45/55 split group — a split group, not a bare subaccount, because
      // only bearer_type "all-proportional" shares the gateway fee between both
      // parties. See docs/10-payments.md.
      split_code: splitCode,
      metadata: { orderId: order.orderId, bookId },
    });
    const authorizationUrl = res.data.authorization_url;
    // Publish the URL so a concurrent tab resumes this transaction instead of
    // opening its own — and only release it to the shopper if publication was
    // allowed. A false here means another tab took this order over while we
    // were at the gateway. Paystack has still minted a live, payable session
    // for us, so handing it over would put two payable sessions on one book.
    const published = await ctx.runMutation(internal.payments.attachAuthorizationUrl, {
      reference,
      authorizationUrl,
    });
    if (!published) {
      throw new ConvexError("Your checkout was restarted in another tab. Please try again there.");
    }
    return { authorizationUrl, reference };
  } catch (e) {
    // The order never reached the gateway, so retire it now. Left pending it
    // would hold the checkout lock and block the customer from retrying.
    const message = e instanceof PaystackError ? e.message : "Could not reach the payment provider.";
    await ctx.runMutation(internal.payments.abandonOrder, { reference, reason: "initialize_failed" });
    // Surface the gateway's own words to the shopper rather than a blank
    // failure — "currency not supported" is the one they will actually hit if
    // the store's base currency is not enabled on the Paystack account.
    throw new ConvexError(message);
  }
}
