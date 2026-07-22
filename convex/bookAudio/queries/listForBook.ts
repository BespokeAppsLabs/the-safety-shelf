import { v } from "convex/values";
import { query } from "../../_generated/server";

// Narrated chapters for one language, in order, with playable URLs. A row with
// no lang predates multi-language audio and counts as the original.
export const listForBook = query({
  args: { bookId: v.id("books"), lang: v.string() },
  handler: async (ctx, { bookId, lang }) => {
    const book = await ctx.db.get(bookId);
    if (!book) return [];

    const rows = (
      await ctx.db
        .query("bookAudio")
        .withIndex("by_book", (q) => q.eq("bookId", bookId))
        .collect()
    ).filter((row) => (row.lang ?? book.originalLang) === lang);

    return Promise.all(
      rows
        .sort((a, b) => a.chapter - b.chapter)
        .map(async (row) => ({
          chapter: row.chapter,
          chars: row.chars,
          url: await ctx.storage.getUrl(row.storageId),
        })),
    );
  },
});
