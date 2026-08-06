import { ConvexError, v } from "convex/values";
import { internalMutation } from "./_generated/server";

export const createUploadUrl = internalMutation({
  args: {},
  handler: (ctx) => ctx.storage.generateUploadUrl(),
});

export const attach = internalMutation({
  args: { slug: v.string(), storageId: v.id("_storage") },
  handler: async (ctx, { slug, storageId }) => {
    const category = await ctx.db
      .query("categories")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (!category) throw new ConvexError(`Category "${slug}" not found`);

    await ctx.db.patch(category._id, { imageStorageId: storageId });
    if (category.imageStorageId && category.imageStorageId !== storageId) {
      await ctx.storage.delete(category.imageStorageId);
    }
    return category._id;
  },
});
