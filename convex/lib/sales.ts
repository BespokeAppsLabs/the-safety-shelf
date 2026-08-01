import type { QueryCtx } from "../_generated/server";

/**
 * Order line items that represent money the store actually kept.
 *
 * Every sales figure routes through here. Reading `orderItems` directly counts
 * rows attached to orders that were refunded, abandoned, comped, or are still
 * "pending" because the shopper opened Paystack and walked away — none of that
 * is revenue. Filtering in one place is what stops the dashboard, the admin
 * catalog and the agent's stats tools from each reporting a different number.
 *
 * "paid" is deliberately the only status counted, so a status added later is
 * excluded until someone decides it is income.
 */
export async function paidOrderItems(ctx: QueryCtx) {
  const [orders, items] = await Promise.all([
    ctx.db.query("orders").collect(),
    ctx.db.query("orderItems").collect(),
  ]);
  const paid = new Set(orders.filter((order) => order.status === "paid").map((order) => order._id));
  return items.filter((item) => paid.has(item.orderId));
}
