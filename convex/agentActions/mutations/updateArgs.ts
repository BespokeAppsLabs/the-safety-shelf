import { ConvexError, v } from "convex/values";
import { viewerMutation, requireOwner } from "../../lib/auth";

// The owner's edit of a draft before approving it. Only a still-proposed
// writeBook can be edited — everything else either has no editable draft
// (publishBook points at a book that already has its own editor) or has
// already been executed. The patch is merged, not swapped, so fields the
// review dialog doesn't show (categoryId, author, ageGroup) survive.
export const updateArgs = viewerMutation({
  args: {
    actionId: v.id("agentActions"),
    title: v.string(),
    blurb: v.string(),
    priceCents: v.number(),
    chapters: v.array(v.object({ heading: v.string(), paragraphs: v.array(v.string()) })),
  },
  handler: async (ctx, { actionId, ...patch }) => {
    requireOwner(ctx.viewer);

    const action = await ctx.db.get(actionId);
    if (!action) throw new ConvexError("Agent action not found");
    if (action.status !== "proposed") {
      throw new ConvexError(`Cannot edit an action in status "${action.status}"`);
    }
    if (action.tool !== "writeBook") {
      throw new ConvexError(`Cannot edit args for tool "${action.tool}"`);
    }
    // Mirrors the executor's checks, so an edit can't leave behind args that
    // approveAndExecute will refuse.
    if (!patch.title.trim()) throw new ConvexError("Title is required");
    if (!(patch.priceCents > 0)) throw new ConvexError("priceCents must be positive");

    await ctx.db.patch(actionId, { args: { ...action.args, ...patch, title: patch.title.trim() } });
  },
});
