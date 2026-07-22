import { ConvexError, v } from "convex/values";
import { viewerMutation, requireOwner } from "../../lib/auth";

// Edit a variant's title/blurb and publish state (draft ⇄ live).
export const update = viewerMutation({
  args: {
    variantId: v.id("bookVariants"),
    title: v.optional(v.string()),
    blurb: v.optional(v.string()),
    status: v.optional(v.union(v.literal("draft"), v.literal("live"))),
  },
  handler: async (ctx, { variantId, ...fields }) => {
    requireOwner(ctx.viewer);
    const variant = await ctx.db.get(variantId);
    if (!variant) throw new ConvexError("Variant not found");
    await ctx.db.patch(variantId, fields);
  },
});
