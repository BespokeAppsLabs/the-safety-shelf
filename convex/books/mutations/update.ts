import { ConvexError, v } from "convex/values";
import { viewerMutation, requireOwner } from "../../lib/auth";
import { assertUniqueTitle } from "../../lib/books";

// Edit a book's metadata from the admin editor. Slug and originalLang are
// immutable (slug is the public URL); content lives in bookBlocks.setBlocks and
// publish state can also be flipped here. Same guards as create.
export const update = viewerMutation({
  args: {
    bookId: v.id("books"),
    title: v.string(),
    author: v.string(),
    blurb: v.string(),
    priceCents: v.number(),
    categoryId: v.id("categories"),
    ageGroup: v.string(),
    status: v.union(v.literal("draft"), v.literal("live"), v.literal("archived")),
    kind: v.optional(v.union(v.literal("guide"), v.literal("storybook"))),
  },
  handler: async (ctx, { bookId, ...fields }) => {
    requireOwner(ctx.viewer);

    const book = await ctx.db.get(bookId);
    if (!book) throw new ConvexError("Book not found");
    if (fields.priceCents <= 0) throw new ConvexError("priceCents must be positive");
    await assertUniqueTitle(ctx, fields.title, bookId);

    const category = await ctx.db.get(fields.categoryId);
    if (!category) throw new ConvexError("Unknown categoryId");

    await ctx.db.patch(bookId, fields);
  },
});
