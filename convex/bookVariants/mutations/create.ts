import { ConvexError, v } from "convex/values";
import { viewerMutation, requireOwner } from "../../lib/auth";

// Create a draft language variant. One per (book, lang) — translate re-runs
// update the existing one rather than duplicating.
export const create = viewerMutation({
  args: {
    bookId: v.id("books"),
    lang: v.string(),
    title: v.optional(v.string()),
    blurb: v.optional(v.string()),
  },
  handler: async (ctx, { bookId, lang, title, blurb }) => {
    requireOwner(ctx.viewer);

    const book = await ctx.db.get(bookId);
    if (!book) throw new ConvexError("Book not found");

    const existing = await ctx.db
      .query("bookVariants")
      .withIndex("by_book_lang", (q) => q.eq("bookId", bookId).eq("lang", lang))
      .unique();
    if (existing) throw new ConvexError(`A "${lang}" variant already exists for this book`);

    return ctx.db.insert("bookVariants", { bookId, lang, status: "draft", title, blurb });
  },
});
