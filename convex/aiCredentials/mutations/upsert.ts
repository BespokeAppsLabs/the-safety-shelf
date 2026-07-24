import { v } from "convex/values";
import { internalMutation } from "../../_generated/server";
import { OPENROUTER_TEXT_MODEL } from "../providers";

export const upsert = internalMutation({
  args: {
    ownerId: v.id("users"),
    encryptedKey: v.string(),
    keyLast4: v.string(),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db.query("aiCredentials").withIndex("by_owner", (q) => q.eq("ownerId", args.ownerId)).collect();
    const existing = rows.find((row) => row.provider === "openrouter");
    await Promise.all(rows.filter((row) => row._id !== existing?._id && row.isActive).map((row) => ctx.db.patch(row._id, { isActive: false })));
    const row = {
      ownerId: args.ownerId,
      purpose: "text" as const,
      provider: "openrouter" as const,
      kind: "apiKey" as const,
      encryptedKey: args.encryptedKey,
      keyLast4: args.keyLast4,
      baseURL: "https://openrouter.ai/api/v1",
      model: OPENROUTER_TEXT_MODEL,
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
