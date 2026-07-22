import { v } from "convex/values";
import { viewerQuery, requireOwner } from "../../lib/auth";

// Admin editor lookup — resolves a book by slug regardless of status (unlike
// the public getBySlug, which is live-only), so the owner can open drafts.
export const getAnyBySlug = viewerQuery({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    requireOwner(ctx.viewer);
    const book = await ctx.db
      .query("books")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    return book ? { ...book, coverUrl: book.coverStorageId ? await ctx.storage.getUrl(book.coverStorageId) : null } : null;
  },
});
