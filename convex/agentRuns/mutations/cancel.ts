import { v } from "convex/values";
import { viewerMutation, requireOwner } from "../../lib/auth";

// The owner's stop. Flags the run cancelled; the sendMessage action's poll
// sees it and aborts generation. Inserts a pre-cancelled row if the run row
// doesn't exist yet, so a stop that races ahead of the action still lands.
export const cancel = viewerMutation({
  args: { runId: v.string() },
  handler: async (ctx, { runId }) => {
    requireOwner(ctx.viewer);

    const existing = await ctx.db
      .query("agentRuns")
      .withIndex("by_runId", (q) => q.eq("runId", runId))
      .unique();

    if (existing) {
      if (existing.ownerId !== ctx.viewer._id) return; // not this owner's run — ignore
      await ctx.db.patch(existing._id, { cancelled: true });
      return;
    }
    await ctx.db.insert("agentRuns", { runId, ownerId: ctx.viewer._id, cancelled: true });
  },
});
