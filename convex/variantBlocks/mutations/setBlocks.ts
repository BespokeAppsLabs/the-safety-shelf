import { ConvexError, v } from "convex/values";
import { viewerMutation, requireOwner } from "../../lib/auth";

const blockArg = v.object({
  chapter: v.number(),
  ord: v.number(),
  type: v.union(v.literal("h"), v.literal("p"), v.literal("img")),
  text: v.optional(v.string()),
  imgStorageId: v.optional(v.id("_storage")),
});

// Full replace of a variant's blocks — mirror of bookBlocks.setBlocks, keyed
// by variantId. How translate (and manual edits) write a variant's content.
export const setBlocks = viewerMutation({
  args: { variantId: v.id("bookVariants"), blocks: v.array(blockArg) },
  handler: async (ctx, { variantId, blocks }) => {
    requireOwner(ctx.viewer);

    const variant = await ctx.db.get(variantId);
    if (!variant) throw new ConvexError("Variant not found");

    for (const block of blocks) {
      if (block.type === "img" && !block.imgStorageId) throw new ConvexError("img block requires imgStorageId");
      if (block.type !== "img" && !block.text) throw new ConvexError(`${block.type} block requires text`);
    }

    const existing = await ctx.db
      .query("variantBlocks")
      .withIndex("by_variant", (q) => q.eq("variantId", variantId))
      .collect();
    for (const row of existing) await ctx.db.delete(row._id);

    for (const block of blocks) await ctx.db.insert("variantBlocks", { variantId, ...block });
  },
});
