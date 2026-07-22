import { v } from "convex/values";
import { viewerQuery, requireOwner } from "../../lib/auth";

// All language variants of a book, for the editor's Translations tab.
export const list = viewerQuery({
  args: { bookId: v.id("books") },
  handler: async (ctx, { bookId }) => {
    requireOwner(ctx.viewer);
    return ctx.db
      .query("bookVariants")
      .withIndex("by_book", (q) => q.eq("bookId", bookId))
      .collect();
  },
});
