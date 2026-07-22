import { viewerQuery, requireOwner } from "../../lib/auth";

// Units sold per book, for the admin catalog table. Real count from
// orderItems — no mock numbers (see docs/05-data-model.md "Honest states").
export const salesCounts = viewerQuery({
  args: {},
  handler: async (ctx) => {
    requireOwner(ctx.viewer);

    const items = await ctx.db.query("orderItems").collect();
    const counts: Record<string, number> = {};
    for (const item of items) {
      counts[item.bookId] = (counts[item.bookId] ?? 0) + 1;
    }
    return counts;
  },
});
