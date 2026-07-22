import { v } from "convex/values";
import { viewerQuery, requireOwner } from "../../lib/auth";

// Owner lookup by id — used by the translate/audiobook actions to read a book's
// title, blurb, and originalLang.
export const getById = viewerQuery({
  args: { bookId: v.id("books") },
  handler: async (ctx, { bookId }) => {
    requireOwner(ctx.viewer);
    return ctx.db.get(bookId);
  },
});
