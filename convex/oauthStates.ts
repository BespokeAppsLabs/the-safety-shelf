import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

export const create = internalMutation({
  args: {
    state: v.string(),
    ownerId: v.id("users"),
    provider: v.literal("higgsfield"),
    codeVerifier: v.string(),
    clientId: v.string(),
    redirectUri: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => ctx.db.insert("oauthStates", args),
});

export const consume = internalMutation({
  args: { state: v.string() },
  handler: async (ctx, { state }) => {
    const row = await ctx.db.query("oauthStates").withIndex("by_state", (q) => q.eq("state", state)).unique();
    if (!row) throw new ConvexError("OAuth state not found or already used.");
    if (row.expiresAt < Date.now()) {
      await ctx.db.delete(row._id);
      throw new ConvexError("OAuth state expired. Start Higgsfield connection again.");
    }
    await ctx.db.delete(row._id);
    return row;
  },
});
