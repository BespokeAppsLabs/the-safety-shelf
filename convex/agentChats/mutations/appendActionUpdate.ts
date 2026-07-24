import { v } from "convex/values";
import { viewerMutation, requireOwner } from "../../lib/auth";

// Image approvals run from a card, outside agent.sendMessage. Add a durable
// assistant update to the matching thread so a generation failure is visible
// in the chat feed and is available to the next model turn.
export const appendActionUpdate = viewerMutation({
  args: { actionId: v.id("agentActions"), content: v.string() },
  handler: async (ctx, { actionId, content }) => {
    requireOwner(ctx.viewer);
    const chats = await ctx.db.query("agentChats").withIndex("by_owner", (q) => q.eq("ownerId", ctx.viewer._id)).collect();
    const chat = chats.find((candidate) => candidate.messages.some((message) =>
      message.cards?.some((card) =>
        card.props && typeof card.props === "object" && (card.props as { actionId?: unknown }).actionId === actionId,
      ),
    ));
    if (!chat || chat.messages.some((message) => message.actionId === actionId)) return false;

    await ctx.db.patch(chat._id, {
      messages: [...chat.messages, { role: "assistant", content, actionId }],
      updatedAt: Date.now(),
    });
    return true;
  },
});
