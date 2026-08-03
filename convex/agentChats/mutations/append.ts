import { ConvexError, v } from "convex/values";
import { viewerMutation, requireOwner } from "../../lib/auth";

const cards = v.optional(v.array(v.object({ component: v.string(), props: v.any() })));

// Commits one chat turn. Called by the client AFTER agent.sendMessage returns
// (or, when the owner presses Esc, with a "stopped" note as the assistant
// content) — so the client, not the server, decides what actually enters the
// thread. That's what makes Esc a real stop: a cancelled turn is simply never
// committed. Appends to an existing session or opens a new one titled from the
// first user message. Returns the session id so the client can pin it active.
export const appendTurn = viewerMutation({
  args: {
    chatId: v.optional(v.id("agentChats")),
    userContent: v.string(),
    assistantContent: v.string(),
    cards,
    tools: v.optional(v.array(v.string())),
    modelMessages: v.optional(v.array(v.any())),
    // Set when the owner stopped this turn — tags both messages so the model's
    // history load (getForOwner) drops them while the thread still shows them.
    stopped: v.optional(v.boolean()),
  },
  handler: async (ctx, { chatId, userContent, assistantContent, cards, tools, modelMessages, stopped }) => {
    requireOwner(ctx.viewer);

    const turn = [
      { role: "user" as const, content: userContent, stopped },
      { role: "assistant" as const, content: assistantContent, cards, tools, modelMessages, stopped },
    ];

    if (chatId) {
      const chat = await ctx.db.get(chatId);
      if (!chat || chat.ownerId !== ctx.viewer._id) throw new ConvexError("Chat not found");
      await ctx.db.patch(chatId, { messages: [...chat.messages, ...turn], updatedAt: Date.now() });
      return chatId;
    }

    const title = userContent.trim().slice(0, 60) || "New chat";
    return ctx.db.insert("agentChats", { ownerId: ctx.viewer._id, title, messages: turn, updatedAt: Date.now() });
  },
});
