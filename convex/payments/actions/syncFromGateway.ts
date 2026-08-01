import { v } from "convex/values";
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
 * Callable by the shopper (the callback page runs it once on mount). That is
 * safe because it grants nothing on its own — it only relays Paystack's own
 * verdict, and only for a reference the caller already holds.
 */
export const syncFromGateway = action({
  args: { reference: v.string() },
  // Explicit return type: the handler calls a mutation reached through the
  // generated `internal` API, and without it TypeScript chases its own tail
  // inferring this module's type from the API it is part of.
  handler: async (ctx, { reference }): Promise<{ status: string }> => {
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
