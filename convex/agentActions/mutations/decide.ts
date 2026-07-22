import { ConvexError, v } from "convex/values";
import { viewerMutation, requireOwner } from "../../lib/auth";

// Step 2: the owner's Approve/Reject click on a proposed tool call.
export const decide = viewerMutation({
  args: { actionId: v.id("agentActions"), decision: v.union(v.literal("approved"), v.literal("rejected")) },
  handler: async (ctx, { actionId, decision }) => {
    requireOwner(ctx.viewer);

    const action = await ctx.db.get(actionId);
    if (!action) throw new ConvexError("Agent action not found");
    if (action.status !== "proposed") {
      throw new ConvexError(`Cannot decide an action in status "${action.status}"`);
    }

    await ctx.db.patch(actionId, { status: decision, decidedAt: Date.now(), decidedBy: ctx.viewer._id });
  },
});
