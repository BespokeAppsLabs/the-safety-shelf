import { v } from "convex/values";
import { viewerQuery, requireOwner } from "../../lib/auth";

// Owner lookup by id — used by the translate/audiobook actions to read a book's
// title, blurb, and originalLang.
export const getById = viewerQuery({
  args: { bookId: v.id("books") },
  handler: async (ctx, { bookId }) => {
    requireOwner(ctx.viewer);
    const book = await ctx.db.get(bookId);
    return book ? { ...book, coverUrl: book.coverStorageId ? await ctx.storage.getUrl(book.coverStorageId) : null } : null;
  },
});
