import { v } from "convex/values";
import { internalMutation } from "../../_generated/server";

// Cleanup once a run ends (completed, errored, or aborted).
export const finish = internalMutation({
  args: { runId: v.string() },
  handler: async (ctx, { runId }) => {
    const run = await ctx.db
      .query("agentRuns")
      .withIndex("by_runId", (q) => q.eq("runId", runId))
      .unique();
    if (run) await ctx.db.delete(run._id);
  },
});
