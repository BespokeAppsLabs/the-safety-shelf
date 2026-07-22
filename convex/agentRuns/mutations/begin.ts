import { v } from "convex/values";
import { internalMutation } from "../../_generated/server";

// Called by the sendMessage action at start. Returns whether the run was
// already cancelled (a stop that beat the action here) — in which case the
// action skips generation entirely. Otherwise records the live run so the
// poll has a row to watch.
export const begin = internalMutation({
  args: { runId: v.string(), ownerId: v.id("users") },
  handler: async (ctx, { runId, ownerId }) => {
    const existing = await ctx.db
      .query("agentRuns")
      .withIndex("by_runId", (q) => q.eq("runId", runId))
      .unique();

    if (existing) return { cancelled: existing.cancelled };
    await ctx.db.insert("agentRuns", { runId, ownerId, cancelled: false });
    return { cancelled: false };
  },
});
