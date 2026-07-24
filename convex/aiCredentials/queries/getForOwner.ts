import { v } from "convex/values";
import { internalQuery } from "../../_generated/server";

export const getForOwner = internalQuery({
  args: { ownerId: v.id("users") },
  handler: async (ctx, { ownerId }) => {
    const rows = await ctx.db.query("aiCredentials").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).collect();
    return rows.find((row) => row.provider === "openrouter" && row.isActive) ?? null;
  },
});
