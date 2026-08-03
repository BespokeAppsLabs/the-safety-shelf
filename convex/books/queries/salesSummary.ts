import { viewerQuery, requireOwner } from "../../lib/auth";
import { paidOrderItems } from "../../lib/sales";

// Units + revenue per book, from real orderItems (snapshot pricing) — not
// derived from books.priceCents, which can change after a sale. Backs the
// agent's read-only stats tools (getTopSellers, getRevenue, getBookStats).
export const salesSummary = viewerQuery({
  args: {},
  handler: async (ctx) => {
    requireOwner(ctx.viewer);

    const items = await paidOrderItems(ctx);
    const summary: Record<string, { units: number; revenueCents: number }> = {};
    for (const item of items) {
      const entry = summary[item.bookId] ?? { units: 0, revenueCents: 0 };
      entry.units += 1;
      entry.revenueCents += item.priceCents;
      summary[item.bookId] = entry;
    }
    return summary;
  },
});
