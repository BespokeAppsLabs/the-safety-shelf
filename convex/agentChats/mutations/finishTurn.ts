import { v } from "convex/values";
import { internalMutation } from "../../_generated/server";

// Closes the turn startTurn opened: appends the assistant message and clears
// the running flag. Called by sendMessage on normal success, model error, and
// owner stop. A process kill cannot run cleanup; the shared ten-minute lease is
// what makes that abnormal path replaceable.
//
// Internal, not public: the client no longer decides what enters the thread.
// That is the whole point — a browser that has navigated away cannot commit
// anything, and the reply must land regardless.
export const finishTurn = internalMutation({
  args: {
    chatId: v.id("agentChats"),
    runId: v.string(),
    content: v.string(),
    cards: v.optional(v.array(v.object({ component: v.string(), props: v.any() }))),
    tools: v.optional(v.array(v.string())),
    toolErrors: v.optional(v.array(v.string())),
    modelMessages: v.optional(v.array(v.any())),
    stopped: v.optional(v.boolean()),
  },
  handler: async (ctx, { chatId, runId, content, cards, tools, toolErrors, modelMessages, stopped }) => {
    const chat = await ctx.db.get(chatId);
    if (!chat) return;

    // Actions may retry a settlement after a mutation response is lost. The
    // first mutation is atomic, so a matching assistant row proves this turn
    // already landed and must not be appended twice.
    if (chat.messages.some((message) => message.role === "assistant" && message.runId === runId)) return;

    // A newer turn already owns this session (the owner stopped this one and
    // sent again). Its message still belongs in the thread, but it must not
    // clear the newer run's flag and claim the session is idle.
    const stale = chat.runId !== runId;

    const messages = [...chat.messages];
    const userIndex = messages.findLastIndex((message) =>
      message.role === "user" && (message.runId === runId || (!message.runId && chat.runId === runId)),
    );
    if (userIndex === -1) return;
    // A stopped turn takes its user message out of the model's history too
    // (getForOwner drops `stopped`), so the agent never resumes a request the
    // owner abandoned. The message stays visible in the thread.
    if (stopped) {
      messages[userIndex] = { ...messages[userIndex], stopped: true };
    }
    // Insert beside the originating user message. Normally no later turn can
    // start while this one is active; this also keeps ordering correct if an
    // expired run lands after a replacement was opened.
    messages.splice(userIndex + 1, 0, {
      role: "assistant" as const,
      content,
      runId,
      cards,
      tools,
      toolErrors,
      modelMessages,
      stopped,
    });

    await ctx.db.patch(chatId, {
      messages,
      updatedAt: Date.now(),
      ...(stale ? {} : { runId: undefined, runStartedAt: undefined }),
    });
  },
});
