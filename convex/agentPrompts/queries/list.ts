import { viewerQuery, requireOwner } from "../../lib/auth";

// Full version history, newest first — the revision trail.
export const list = viewerQuery({
  args: {},
  handler: async (ctx) => {
    requireOwner(ctx.viewer);

    const rows = await ctx.db.query("agentPrompts").collect();
    return rows.sort((a, b) => b.version - a.version);
  },
});
