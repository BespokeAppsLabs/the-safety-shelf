import { ConvexError, v } from "convex/values";
import { viewerMutation, requireOwner } from "../../lib/auth";

// Books are always created as drafts; publish is a separate, explicit step
// (books.setStatus) — matches the propose-then-confirm rule that nothing
// goes live in one shot.
export const create = viewerMutation({
  args: {
    slug: v.string(),
    title: v.string(),
    author: v.string(),
    priceCents: v.number(),
    categoryId: v.id("categories"),
    ageGroup: v.string(),
    originalLang: v.string(),
    blurb: v.string(),
    kind: v.optional(v.union(v.literal("guide"), v.literal("storybook"))),
  },
  handler: async (ctx, args) => {
    requireOwner(ctx.viewer);

    if (args.priceCents <= 0) throw new ConvexError("priceCents must be positive");

    const category = await ctx.db.get(args.categoryId);
    if (!category) throw new ConvexError("Unknown categoryId");

    const existing = await ctx.db
      .query("books")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (existing) throw new ConvexError(`Book slug "${args.slug}" already exists`);

    return ctx.db.insert("books", { ...args, kind: args.kind ?? "guide", status: "draft" });
  },
});
