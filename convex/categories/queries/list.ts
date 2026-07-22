import { query } from "../../_generated/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("categories").collect();
    return rows.sort((a, b) => a.sortOrder - b.sortOrder);
  },
});
