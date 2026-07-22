import { v } from "convex/values";
import { query } from "../../_generated/server";

// Ordered content for the reader / sample preview. by_book is (bookId,
// chapter, ord), so the range query returns blocks already in reading order.
export const listByBook = query({
  args: { bookId: v.id("books") },
  handler: async (ctx, { bookId }) => {
    const rows = await ctx.db
      .query("bookBlocks")
      .withIndex("by_book", (q) => q.eq("bookId", bookId))
      .collect();
    return Promise.all(rows.map(async (row) => ({
      ...row,
      imageUrl: row.imgStorageId ? await ctx.storage.getUrl(row.imgStorageId) : null,
    })));
  },
});
