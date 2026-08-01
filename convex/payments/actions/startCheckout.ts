// Default Convex runtime on purpose — the Paystack client needs only `fetch`
// and Web Crypto, and "use node" would buy nothing but slower cold starts.
import { ConvexError, v } from "convex/values";
import { action } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { initializeTransaction, PaystackError } from "../../lib/paystack/client";

/**
 * Opens a Paystack hosted checkout for one book and returns the URL to send
 * the shopper to. Grants nothing — the signed webhook does that.
 */
export const startCheckout = action({
  args: { bookId: v.id("books") },
  handler: async (ctx, { bookId }): Promise<{ authorizationUrl: string; reference: string }> => {
    // Opaque and unguessable. Generated here so the order row and the Paystack
    // transaction agree on it from the very first write.
    const reference = `TSS-${crypto.randomUUID()}`;

    // Auth propagates through runMutation, so the guards run as this viewer.
    const order = await ctx.runMutation(internal.payments.createPendingOrder, { bookId, reference });

    const appUrl = process.env.APP_URL;
    if (!appUrl) {
      throw new ConvexError(
        "APP_URL is not set on the Convex deployment. Run: npx convex env set APP_URL <url>",
      );
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
        // The 45/55 split group. Absent in local dev without a split
        // configured, which Paystack accepts as an unsplit transaction.
        split_code: process.env.PAYSTACK_SPLIT_CODE,
        metadata: { orderId: order.orderId, bookId },
      });
      return { authorizationUrl: res.data.authorization_url, reference };
    } catch (e) {
      // Surface the gateway's own words to the shopper rather than a blank
      // failure — "currency not supported" is the one they will actually hit
      // if the store's base currency is not enabled on the Paystack account.
      const message = e instanceof PaystackError ? e.message : "Could not reach the payment provider.";
      throw new ConvexError(message);
    }
  },
});
