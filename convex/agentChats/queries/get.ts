import { v, ConvexError } from "convex/values";
import { viewerQuery, requireOwner } from "../../lib/auth";

// Full thread for the live session — the client subscribes reactively, so a
// turn persisted by agent.sendMessage shows up here without a manual refetch.
export const get = viewerQuery({
  args: { chatId: v.id("agentChats") },
  handler: async (ctx, { chatId }) => {
    requireOwner(ctx.viewer);
    const chat = await ctx.db.get(chatId);
    if (!chat || chat.ownerId !== ctx.viewer._id) throw new ConvexError("Chat not found");
    return chat;
  },
});
