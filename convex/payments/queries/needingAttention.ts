import { viewerQuery, requireOwner } from "../../lib/auth";

/**
 * Payments a human has to look at, most recent first.
 *
 * These are the states the automated path deliberately refuses to resolve on
 * its own: a customer charged twice, or a settlement whose amount or currency
 * disagreed with the order. Each needs an operator decision (usually a refund
 * in the Paystack dashboard) — code cannot make that call.
 *
 * This query exists because the alternative was writing the same facts to
 * `eventLogs`, which nothing in the app reads. Evidence nobody sees is not an
 * escalation, so this is surfaced on the admin dashboard instead.
 */
const NEEDS_OPERATOR = ["duplicate_purchase", "amount_mismatch", "currency_mismatch", "verification_missing"];

export const needingAttention = viewerQuery({
  args: {},
  handler: async (ctx) => {
    requireOwner(ctx.viewer);

    const orders = await ctx.db.query("orders").collect();
    // Refunded orders are excluded even if a flag lingers: the refund is the
    // resolution, so continuing to alert on one is noise that trains the owner
    // to ignore the panel.
    const flagged = orders.filter(
      (o) =>
        o.status !== "refunded" &&
        !o.alertResolvedAt &&
        o.failureReason &&
        NEEDS_OPERATOR.includes(o.failureReason),
    );

    return Promise.all(
      flagged
        .sort((a, b) => b._creationTime - a._creationTime)
        .map(async (order) => {
          const user = await ctx.db.get(order.userId);
          return {
            id: order._id,
            reference: order.reference,
            reason: order.failureReason!,
            status: order.status,
            totalCents: order.totalCents,
            currency: order.currency,
            email: user?.email ?? null,
            createdAt: order._creationTime,
          };
        }),
    );
  },
});
