import { ConvexError, v } from "convex/values";
import { action } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { verifyTransaction } from "../../lib/paystack/client";

/**
 * Ask Paystack directly what happened to a transaction, then reconcile.
 *
 * The webhook is the primary path and usually wins, but the shopper's browser
 * can return first, and a webhook can be dropped or misconfigured outright.
 * Without this the customer would be left staring at a spinner holding a
 * receipt. Reconcile is idempotent, so whichever arrives second is a no-op.
 *
 * Callable only by the signed-in owner of the order. It used to accept any
 * reference from anyone, which turned the store into a free proxy onto
 * Paystack's rate-limited verify endpoint: an anonymous caller could burn the
 * integration's quota and take real checkouts down with it.
 */
export const syncFromGateway = action({
  args: { reference: v.string() },
  handler: async (ctx, { reference }): Promise<{ status: string }> => {
    // Ownership is checked before we spend a gateway call, not after.
    const owns = await ctx.runQuery(internal.payments.isOwnPendingOrder, { reference });
    if (!owns) throw new ConvexError("Unknown order");

    let tx;
    try {
      tx = (await verifyTransaction(reference)).data;
    } catch {
      // Gateway unreachable. The webhook is still coming; the callback page
      // keeps waiting on its live query rather than showing a false failure.
      return { status: "unverified" as const };
    }

    // Paystack reports the real outcome in `data.status`, not the envelope's
    // top-level `status`, which is only "was the API call well-formed".
    return ctx.runMutation(internal.payments.reconcile, {
      reference,
      outcome: tx.status === "success" ? "success" : "failed",
      amount: tx.amount,
      currency: tx.currency,
      providerTransactionId: tx.id != null ? String(tx.id) : undefined,
      failureReason: tx.gateway_response,
    });
  },
});
