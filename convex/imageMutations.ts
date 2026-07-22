import { ConvexError, v } from "convex/values";
import { internalMutation } from "./_generated/server";

export const setCover = internalMutation({
  args: { bookId: v.id("books"), storageId: v.id("_storage") },
  handler: async (ctx, { bookId, storageId }) => {
    if (!(await ctx.db.get(bookId))) throw new ConvexError("Book not found");
    await ctx.db.patch(bookId, { coverStorageId: storageId });
  },
});

export const setChapterImage = internalMutation({
  args: { bookId: v.id("books"), chapter: v.number(), storageId: v.id("_storage") },
  handler: async (ctx, { bookId, chapter, storageId }) => {
    if (!(await ctx.db.get(bookId))) throw new ConvexError("Book not found");
    const rows = await ctx.db.query("bookBlocks").withIndex("by_book", (q) => q.eq("bookId", bookId)).collect();
    const existing = rows.find((row) => row.chapter === chapter && row.type === "img");
    if (existing) {
      await ctx.db.patch(existing._id, { imgStorageId: storageId });
      return;
    }
    for (const row of rows.filter((row) => row.chapter === chapter && row.ord >= 1).sort((a, b) => b.ord - a.ord)) {
      await ctx.db.patch(row._id, { ord: row.ord + 1 });
    }
    await ctx.db.insert("bookBlocks", { bookId, chapter, ord: 1, type: "img", imgStorageId: storageId });
  },
});
