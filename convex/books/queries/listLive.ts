import { query } from "../../_generated/server";

// Storefront catalog grid — only ever shows published books.
export const listLive = query({
  args: {},
  handler: async (ctx) => {
    const books = await ctx.db
      .query("books")
      .withIndex("by_status", (q) => q.eq("status", "live"))
      .collect();
    return Promise.all(books.map(async (book) => ({
      ...book,
      coverUrl: book.coverStorageId ? await ctx.storage.getUrl(book.coverStorageId) : null,
    })));
  },
});
