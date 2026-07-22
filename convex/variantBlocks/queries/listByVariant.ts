import { v } from "convex/values";
import { query } from "../../_generated/server";

// Ordered content for a translated variant — same shape/role as
// bookBlocks.listByBook, keyed by variantId.
export const listByVariant = query({
  args: { variantId: v.id("bookVariants") },
  handler: async (ctx, { variantId }) =>
    ctx.db
      .query("variantBlocks")
      .withIndex("by_variant", (q) => q.eq("variantId", variantId))
      .collect(),
});
