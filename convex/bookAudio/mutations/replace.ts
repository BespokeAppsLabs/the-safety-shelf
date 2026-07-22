import { ConvexError, v } from "convex/values";
import { internalMutation } from "../../_generated/server";

// Internal — full-replace of ONE language's narrated chapters. Only deletes
// that language's rows (a row with no lang counts as the original), so
// regenerating one language never wipes the others.
export const replace = internalMutation({
  args: {
    bookId: v.id("books"),
    lang: v.string(),
    model: v.string(),
    voiceId: v.string(),
    rows: v.array(v.object({ chapter: v.number(), storageId: v.id("_storage"), chars: v.number() })),
  },
  handler: async (ctx, { bookId, lang, model, voiceId, rows }) => {
    const book = await ctx.db.get(bookId);
    if (!book) throw new ConvexError("Book not found");

    const existing = await ctx.db
      .query("bookAudio")
      .withIndex("by_book", (q) => q.eq("bookId", bookId))
      .collect();
    for (const row of existing) {
      if ((row.lang ?? book.originalLang) === lang) await ctx.db.delete(row._id);
    }

    for (const row of rows) {
      await ctx.db.insert("bookAudio", { bookId, lang, model, voiceId, ...row });
    }
  },
});
