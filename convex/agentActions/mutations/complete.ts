import { ConvexError, v } from "convex/values";
import { viewerMutation, requireOwner } from "../../lib/auth";

// Step 3: after an approved action's underlying mutation/action actually
// runs, record the outcome.
export const complete = viewerMutation({
  args: {
    actionId: v.id("agentActions"),
    status: v.union(v.literal("executed"), v.literal("failed")),
    result: v.optional(v.any()),
  },
  handler: async (ctx, { actionId, status, result }) => {
    requireOwner(ctx.viewer);

    const action = await ctx.db.get(actionId);
    if (!action) throw new ConvexError("Agent action not found");
    if (action.status !== "approved") {
      throw new ConvexError(`Cannot complete an action in status "${action.status}"`);
    }

    await ctx.db.patch(actionId, { status, result });
  },
});
