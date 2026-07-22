import { ConvexError, v } from "convex/values";
import { viewerMutation, requireOwner } from "../../lib/auth";

// Publishing a new prompt never edits an existing row — it inserts the next
// version and deactivates whatever was active. History stays intact.
export const create = viewerMutation({
  args: { content: v.string(), note: v.optional(v.string()) },
  handler: async (ctx, { content, note }) => {
    requireOwner(ctx.viewer);

    if (!content.trim()) throw new ConvexError("Prompt content cannot be empty");

    const rows = await ctx.db.query("agentPrompts").collect();
    const nextVersion = rows.reduce((max, row) => Math.max(max, row.version), 0) + 1;

    const currentlyActive = rows.filter((row) => row.isActive);
    for (const row of currentlyActive) {
      await ctx.db.patch(row._id, { isActive: false });
    }

    return ctx.db.insert("agentPrompts", {
      version: nextVersion,
      content,
      note,
      isActive: true,
      createdBy: ctx.viewer._id,
    });
  },
});
