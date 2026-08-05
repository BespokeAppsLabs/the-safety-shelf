import { ConvexError, v } from "convex/values";
import { viewerMutation, requireOwner } from "../../lib/auth";

// Throw away an unsaved translation draft, blocks and all.
//
// Without this a rejected translation was a dead end: the draft could not be
// removed, and translate.ts refuses to generate another while any variant on
// the book is unsaved — so one bad translation permanently blocked that book
// from being translated again. Saving was the only exit, which meant the only
// way to get rid of a bad translation was to save it.
//
// Deliberately refuses to touch a saved variant: removing reviewed admin
// content is a different decision from discarding a draft.
export const discard = viewerMutation({
  args: { variantId: v.id("bookVariants") },
  handler: async (ctx, { variantId }) => {
    requireOwner(ctx.viewer);

    const variant = await ctx.db.get(variantId);
    if (!variant) throw new ConvexError("Translation not found");
    if (variant.isSaved !== false) {
      throw new ConvexError("That translation has been saved — it can no longer be discarded as a draft.");
    }

    const blocks = await ctx.db
      .query("variantBlocks")
      .withIndex("by_variant", (q) => q.eq("variantId", variantId))
      .collect();
    for (const block of blocks) await ctx.db.delete(block._id);
    await ctx.db.delete(variantId);

    return { discarded: true, lang: variant.lang };
  },
});
