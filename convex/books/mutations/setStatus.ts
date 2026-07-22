import { ConvexError, v } from "convex/values";
import { viewerMutation, requireOwner } from "../../lib/auth";

export const setStatus = viewerMutation({
  args: {
    bookId: v.id("books"),
    status: v.union(v.literal("draft"), v.literal("live"), v.literal("archived")),
  },
  handler: async (ctx, { bookId, status }) => {
    requireOwner(ctx.viewer);

    const book = await ctx.db.get(bookId);
    if (!book) throw new ConvexError("Book not found");

    await ctx.db.patch(bookId, { status });
  },
});
