import { viewerQuery, requireOwner } from "../../lib/auth";

export const getActive = viewerQuery({
  args: {},
  handler: async (ctx) => {
    requireOwner(ctx.viewer);

    return ctx.db
      .query("agentPrompts")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .unique();
  },
});
