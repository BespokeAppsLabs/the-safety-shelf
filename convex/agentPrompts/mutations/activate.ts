import { ConvexError, v } from "convex/values";
import { viewerMutation, requireOwner } from "../../lib/auth";

// Rollback: re-activate a prior version without deleting or rewriting
// anything — the version history is append-only.
export const activate = viewerMutation({
  args: { promptId: v.id("agentPrompts") },
  handler: async (ctx, { promptId }) => {
    requireOwner(ctx.viewer);

    const target = await ctx.db.get(promptId);
    if (!target) throw new ConvexError("Prompt version not found");
    if (target.isActive) return;

    const rows = await ctx.db.query("agentPrompts").collect();
    for (const row of rows) {
      if (row.isActive) await ctx.db.patch(row._id, { isActive: false });
    }
    await ctx.db.patch(promptId, { isActive: true });
  },
});
