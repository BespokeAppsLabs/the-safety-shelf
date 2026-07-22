import { viewerQuery, requireOwner } from "../../lib/auth";

// History sidebar — session summaries only (no message bodies), newest first.
export const list = viewerQuery({
  args: {},
  handler: async (ctx) => {
    requireOwner(ctx.viewer);
    const chats = await ctx.db
      .query("agentChats")
      .withIndex("by_owner", (q) => q.eq("ownerId", ctx.viewer._id))
      .collect();
    return chats
      .filter((chat) => !chat.deletedAt)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((chat) => ({
        _id: chat._id,
        title: chat.title,
        updatedAt: chat.updatedAt,
        messageCount: chat.messages.length,
      }));
  },
});
