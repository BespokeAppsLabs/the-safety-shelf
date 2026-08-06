import { query } from "../../_generated/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("categories").collect();
    return Promise.all(rows
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(async (row) => ({
        ...row,
        imageUrl: row.imageStorageId ? await ctx.storage.getUrl(row.imageStorageId) : null,
      })));
  },
});
