import { ConvexError, v } from "convex/values";
import { viewerMutation, requireOwner } from "../../lib/auth";
import { isAgentRunActive } from "../../../lib/agentRun";

// Opens a turn: stores the owner's message and marks the session as running,
// BEFORE the agent starts generating.
//
// This used to happen at the end — the client called appendTurn once it had the
// reply, so nothing existed in the database until then. Leaving the page mid-run
// therefore destroyed the whole exchange: the session had never been created,
// the in-flight promise died with the component, and the session was absent from
// History until a reply it would never deliver arrived.
//
// Now the session exists from the first keystroke of the turn. It shows in
// History straight away, it can be reopened while the agent is still working,
// and the reply is committed server-side by finishTurn whether or not anyone is
// watching.
export const startTurn = viewerMutation({
  args: {
    chatId: v.optional(v.id("agentChats")),
    content: v.string(),
    runId: v.string(),
  },
  handler: async (ctx, { chatId, content, runId }) => {
    requireOwner(ctx.viewer);

    const message = { role: "user" as const, content, runId };
    const now = Date.now();

    if (chatId) {
      const chat = await ctx.db.get(chatId);
      if (!chat || chat.ownerId !== ctx.viewer._id) throw new ConvexError("Chat not found");
      if (isAgentRunActive(chat.runId, chat.runStartedAt, now)) {
        throw new ConvexError("This chat is already working on a reply.");
      }
      await ctx.db.patch(chatId, {
        messages: [...chat.messages, message],
        updatedAt: now,
        runId,
        runStartedAt: now,
      });
      return chatId;
    }

    const title = content.trim().slice(0, 60) || "New chat";
    return ctx.db.insert("agentChats", {
      ownerId: ctx.viewer._id,
      title,
      messages: [message],
      updatedAt: now,
      runId,
      runStartedAt: now,
    });
  },
});
