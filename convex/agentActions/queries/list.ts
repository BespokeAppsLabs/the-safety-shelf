import { v } from "convex/values";
import { viewerQuery, requireOwner } from "../../lib/auth";

// Admin's approval queue / action history.
export const list = viewerQuery({
  args: {
    status: v.optional(
      v.union(v.literal("proposed"), v.literal("approved"), v.literal("rejected"), v.literal("executed"), v.literal("failed")),
    ),
  },
  handler: async (ctx, { status }) => {
    requireOwner(ctx.viewer);

    if (status) {
      return ctx.db
        .query("agentActions")
        .withIndex("by_status", (q) => q.eq("status", status))
        .collect();
    }
    return ctx.db.query("agentActions").collect();
  },
});
