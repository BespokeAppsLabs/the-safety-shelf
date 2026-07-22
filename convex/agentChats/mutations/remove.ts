import { ConvexError, v } from "convex/values";
import { viewerMutation, requireOwner } from "../../lib/auth";

// Soft delete — stamps deletedAt so `list` hides the conversation. The row and
// its messages are never removed from the DB.
export const remove = viewerMutation({
  args: { chatId: v.id("agentChats") },
  handler: async (ctx, { chatId }) => {
    requireOwner(ctx.viewer);

    const chat = await ctx.db.get(chatId);
    if (!chat || chat.ownerId !== ctx.viewer._id) throw new ConvexError("Chat not found");

    await ctx.db.patch(chatId, { deletedAt: Date.now() });
  },
});
