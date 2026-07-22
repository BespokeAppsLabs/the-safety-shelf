import { v } from "convex/values";
import { internalMutation } from "../../_generated/server";

// Internal — full-replace of the voice catalog after a sync. Called only by
// voices/actions/sync.ts.
export const replaceAll = internalMutation({
  args: {
    voices: v.array(
      v.object({
        voiceId: v.string(),
        name: v.string(),
        description: v.optional(v.string()),
        category: v.optional(v.string()),
        previewUrl: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, { voices }) => {
    const existing = await ctx.db.query("voices").collect();
    for (const row of existing) await ctx.db.delete(row._id);
    for (const voice of voices) await ctx.db.insert("voices", voice);
  },
});
