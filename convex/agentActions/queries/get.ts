import { v } from "convex/values";
import { viewerQuery, requireOwner } from "../../lib/auth";

// Backs the live status on an inline approval card — the card subscribes so
// Approve/Reject flips its badge without a manual refetch.
export const get = viewerQuery({
  args: { actionId: v.id("agentActions") },
  handler: async (ctx, { actionId }) => {
    requireOwner(ctx.viewer);
    return ctx.db.get(actionId);
  },
});
