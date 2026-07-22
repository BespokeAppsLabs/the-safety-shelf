import { v } from "convex/values";
import { query } from "../../_generated/server";

// Book detail / reader page. Drafts are not resolvable here — the storefront
// has no route to preview an unpublished book; drafts are only visible via
// books.listAll in the admin.
export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const book = await ctx.db
      .query("books")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (!book || book.status !== "live") return null;
    return { ...book, coverUrl: book.coverStorageId ? await ctx.storage.getUrl(book.coverStorageId) : null };
  },
});
