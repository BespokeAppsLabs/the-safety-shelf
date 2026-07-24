import { v } from "convex/values";
import { viewerQuery, requireOwner } from "../../lib/auth";

// Small authoritative action snapshot for the agent's next turn.
export const recent = viewerQuery({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit = 8 }) => {
    requireOwner(ctx.viewer);
    return ctx.db.query("agentActions").withIndex("by_proposedAt").order("desc").take(Math.min(Math.max(limit, 1), 20));
  },
});
