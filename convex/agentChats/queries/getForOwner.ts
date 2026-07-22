import { v } from "convex/values";
import { internalQuery } from "../../_generated/server";

// Internal read for agent.ts (a "use node" action). The action already holds
// the owner's id, so history is loaded by ownerId rather than re-resolving the
// Clerk identity — same shape as aiCredentials.queries.getForOwner.
export const getForOwner = internalQuery({
  args: { ownerId: v.id("users"), chatId: v.id("agentChats") },
  handler: async (ctx, { ownerId, chatId }) => {
    const chat = await ctx.db.get(chatId);
    if (!chat || chat.ownerId !== ownerId) return null;
    // Stopped turns are excluded here (but not from `get`): the model only sees
    // completed exchanges, so it never resumes a request the owner abandoned.
    return chat.messages.filter((message) => !message.stopped);
  },
});
