import { v } from "convex/values";
import { internalMutation } from "../../_generated/server";

// Internal — flips audio status for a specific language. The original's status
// lives on the book; a variant's lives on its bookVariants row.
export const setStatus = internalMutation({
  args: {
    bookId: v.id("books"),
    lang: v.string(),
    status: v.union(v.literal("generating"), v.literal("ready"), v.literal("failed")),
  },
  handler: async (ctx, { bookId, lang, status }) => {
    const book = await ctx.db.get(bookId);
    if (!book) return;

    if (lang === book.originalLang) {
      await ctx.db.patch(bookId, { audioStatus: status });
      return;
    }
    const variant = await ctx.db
      .query("bookVariants")
      .withIndex("by_book_lang", (q) => q.eq("bookId", bookId).eq("lang", lang))
      .unique();
    if (variant) await ctx.db.patch(variant._id, { audioStatus: status });
  },
});
