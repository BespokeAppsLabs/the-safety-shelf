import { v } from "convex/values";
import { internalMutation } from "../../_generated/server";

const providerArg = v.union(v.literal("openai"), v.literal("deepseek"), v.literal("kimi"), v.literal("glm"), v.literal("ollama"), v.literal("stability"), v.literal("higgsfield"));

export const upsert = internalMutation({
  args: {
    ownerId: v.id("users"),
    purpose: v.union(v.literal("text"), v.literal("image")),
    provider: providerArg,
    kind: v.optional(v.union(v.literal("apiKey"), v.literal("chatgptOAuth"), v.literal("mcp"))),
    encryptedKey: v.optional(v.string()),
    keyLast4: v.optional(v.string()),
    baseURL: v.optional(v.string()),
    model: v.optional(v.string()),
    encryptedRefreshToken: v.optional(v.string()),
    accessTokenExpiresAt: v.optional(v.number()),
    clientId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db.query("aiCredentials").withIndex("by_owner", (q) => q.eq("ownerId", args.ownerId)).collect();
    const existing = rows.find((row) => (row.purpose ?? "text") === args.purpose);
    const row = {
      ownerId: args.ownerId,
      purpose: args.purpose,
      provider: args.provider,
      kind: args.kind ?? "apiKey" as const,
      encryptedKey: args.encryptedKey,
      keyLast4: args.keyLast4,
      baseURL: args.baseURL,
      model: args.model,
      encryptedRefreshToken: args.encryptedRefreshToken,
      accessTokenExpiresAt: args.accessTokenExpiresAt,
      clientId: args.clientId,
      isActive: true,
      validatedAt: Date.now(),
    };
    if (existing) {
      await ctx.db.patch(existing._id, row);
      return existing._id;
    }
    return ctx.db.insert("aiCredentials", row);
  },
});
