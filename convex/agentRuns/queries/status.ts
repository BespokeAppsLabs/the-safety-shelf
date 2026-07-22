import { v } from "convex/values";
import { internalQuery } from "../../_generated/server";

// Polled by the sendMessage action while generating. Cheap indexed lookup.
export const status = internalQuery({
  args: { runId: v.string() },
  handler: async (ctx, { runId }) => {
    const run = await ctx.db
      .query("agentRuns")
      .withIndex("by_runId", (q) => q.eq("runId", runId))
      .unique();
    return { cancelled: run?.cancelled ?? false };
  },
});
