import { ConvexError, v } from "convex/values";
import { viewerMutation, requireOwner } from "../../lib/auth";

export const create = viewerMutation({
  args: {
    slug: v.string(),
    title: v.string(),
    icon: v.optional(v.string()),
    description: v.optional(v.string()),
    sortOrder: v.number(),
  },
  handler: async (ctx, args) => {
    requireOwner(ctx.viewer);

    const existing = await ctx.db
      .query("categories")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (existing) throw new ConvexError(`Category slug "${args.slug}" already exists`);

    return ctx.db.insert("categories", args);
  },
});
