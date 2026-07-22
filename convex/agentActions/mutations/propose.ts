import { v } from "convex/values";
import { viewerMutation, requireOwner } from "../../lib/auth";

// Step 1 of propose-then-confirm: a tool call that would write/spend/publish
// logs its proposal instead of executing. See docs/03-admin-agent.md. Once
// the agent runtime (Phase 2) exists, this is called by the tool action
// itself, not directly by the owner's client.
export const propose = viewerMutation({
  args: { tool: v.string(), args: v.any(), relatedBookId: v.optional(v.id("books")) },
  handler: async (ctx, { tool, args, relatedBookId }) => {
    requireOwner(ctx.viewer);

    return ctx.db.insert("agentActions", {
      tool,
      args,
      status: "proposed",
      proposedAt: Date.now(),
      relatedBookId,
    });
  },
});
