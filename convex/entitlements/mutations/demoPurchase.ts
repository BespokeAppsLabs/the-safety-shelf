import { v } from "convex/values";
import { viewerMutation } from "../../lib/auth";
import { createPaidEntitlement } from "../lib";

// Self-serve "Buy" until Stripe Checkout is wired — any signed-in customer
// grants themselves access, no payment. Matches docs/02-storefront.md's demo
// build note: "Buy simulates checkout". Swap point: replace this mutation's
// call site in BuyButton with a redirect to Stripe Checkout; the webhook then
// calls createPaidEntitlement the same way.
export const demoPurchase = viewerMutation({
  args: { bookId: v.id("books") },
  handler: async (ctx, { bookId }) => {
    await createPaidEntitlement(ctx, { userId: ctx.viewer._id, bookId, sessionIdPrefix: "demo" });
  },
});
