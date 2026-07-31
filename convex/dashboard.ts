import { viewerQuery, requireOwner } from "./lib/auth";

// Owner-only overview. Aggregate here so the dashboard has one consistent
// Convex snapshot instead of reimplementing counts in the browser.
export const overview = viewerQuery({
  args: {},
  handler: async (ctx) => {
    requireOwner(ctx.viewer);
    const [books, orders, items, entitlements, actions, pending, accounts, settings] = await Promise.all([
      ctx.db.query("books").collect(),
      ctx.db.query("orders").collect(),
      ctx.db.query("orderItems").collect(),
      ctx.db.query("entitlements").collect(),
      // Recent slice, for the queue panel only.
      ctx.db.query("agentActions").withIndex("by_proposedAt").order("desc").take(6),
      // Counted separately and unbounded: deriving the badge from the 6-item
      // slice above capped it at 6, so a 7th pending approval was invisible on
      // the very dashboard meant to surface it.
      ctx.db.query("agentActions").withIndex("by_status", (q) => q.eq("status", "proposed")).collect(),
      ctx.db.query("socialAccounts").collect(),
      ctx.db.query("storeSettings").first(),
    ]);
    const paidOrders = new Set(orders.filter((order) => order.status === "paid").map((order) => order._id));
    const revenueCents = items.reduce((total, item) => total + (paidOrders.has(item.orderId) ? item.priceCents : 0), 0);
    const drafts = books.filter((book) => book.status === "draft").sort((a, b) => b._creationTime - a._creationTime).slice(0, 6);

    return {
      liveBooks: books.filter((book) => book.status === "live").length,
      revenueCents,
      activeUnlocks: entitlements.filter((entitlement) => !entitlement.revokedAt).length,
      pendingApprovals: pending.length,
      currency: settings?.baseCurrency ?? null,
      queue: [
        ...actions.filter((action) => action.status === "proposed").map((action) => ({
          id: action._id,
          title: action.tool,
          body: "Awaiting owner approval.",
          status: "Needs approval" as const,
          variant: "warning" as const,
          createdAt: action.proposedAt,
        })),
        ...drafts.map((book) => ({
          id: book._id,
          title: book.title,
          body: "Draft book ready for review.",
          status: "Draft" as const,
          variant: "info" as const,
          createdAt: book._creationTime,
        })),
      ].sort((a, b) => b.createdAt - a.createdAt).slice(0, 6),
      accounts,
    };
  },
});
