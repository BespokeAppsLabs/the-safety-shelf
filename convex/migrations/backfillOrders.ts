// DEPLOY-ONCE MIGRATION — required on any deployment that already holds orders.
//
// Moves `orders` off the never-wired Stripe shape onto the provider-neutral one
// Paystack uses: stripeSessionId -> reference, stripePaymentIntentId ->
// providerTransactionId, plus a `currency` snapshot so a later change to
// storeSettings.baseCurrency cannot silently re-denominate historical revenue.
//
// Convex validates every existing document against the schema on push, so the
// final shape (reference/currency REQUIRED) cannot be pushed straight onto a
// deployment holding old rows. Run it in three steps, per deployment:
//
//   1. Push a transitional schema — stripeSessionId, stripePaymentIntentId,
//      reference and currency all v.optional(), status union already widened.
//   2. npx convex run migrations/backfillOrders:run
//   3. Push the final schema in convex/schema.ts (reference + currency required,
//      stripe* removed).
//
// Already applied to: dev (curious-salamander-315), 2 orders, 2026-08-01.
// Delete this file once every deployment has been migrated.
//
// Idempotent: rows that already carry a reference are skipped, so a re-run
// after a partial failure is safe.
import { internalMutation } from "../_generated/server";

export const run = internalMutation({
  args: {},
  handler: async (ctx) => {
    const settings = await ctx.db.query("storeSettings").first();
    if (!settings) {
      // Every historical order was priced in *some* base currency. Guessing one
      // would bake a wrong number into the ledger permanently.
      throw new Error("storeSettings.baseCurrency is not set — set it before migrating orders.");
    }

    const orders = await ctx.db.query("orders").collect();
    let migrated = 0;
    let reclassified = 0;

    for (const order of orders) {
      const legacy = order as typeof order & {
        stripeSessionId?: string;
        stripePaymentIntentId?: string;
      };
      if (!order.reference) {
        await ctx.db.patch(order._id, {
          reference: legacy.stripeSessionId ?? `legacy:${order._id}`,
          providerTransactionId: legacy.stripePaymentIntentId,
          currency: settings.baseCurrency,
          stripeSessionId: undefined,
          stripePaymentIntentId: undefined,
        } as Partial<typeof order>);
        migrated++;
      }

      // Second, independent pass: no money ever changed hands for the
      // pre-Paystack orders. `demo:` was the self-serve stub that granted books
      // free, `manual:`/`comp:` were owner giveaways — every one of them was
      // written status "paid" because "comp" did not exist yet. Left alone they
      // report giveaways as revenue forever.
      //
      // Deliberately separate from the field rename above so a deployment that
      // already ran the earlier version of this migration still gets corrected.
      const reference = (await ctx.db.get(order._id))!.reference;
      const isFree = ["demo:", "manual:", "comp:"].some((p) => reference.startsWith(p));
      if (isFree && order.status === "paid") {
        await ctx.db.patch(order._id, { status: "comp" });
        reclassified++;
      }
    }

    return { total: orders.length, migrated, reclassified };
  },
});
