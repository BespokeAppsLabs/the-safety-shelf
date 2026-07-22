import { v } from "convex/values";
import { internalQuery } from "../../_generated/server";

export const getForOwner = internalQuery({
  args: { ownerId: v.id("users"), purpose: v.optional(v.union(v.literal("text"), v.literal("image"))) },
  handler: async (ctx, { ownerId, purpose }) => {
    const rows = await ctx.db.query("aiCredentials").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).collect();
    const wanted = purpose ?? "text";
    return rows.find((row) => (row.purpose ?? "text") === wanted && row.isActive) ?? null;
  },
});
