import { v } from "convex/values";
import { internalMutation, type MutationCtx } from "../../_generated/server";
import { viewerMutation, requireOwner } from "../../lib/auth";
import type { Id } from "../../_generated/dataModel";

const cards = v.optional(v.array(v.object({ component: v.string(), props: v.any() })));

// Approvals run from a card, outside agent.sendMessage — so their outcome has
// to be posted back into the thread that proposed them, or the chat shows a
// request that apparently went nowhere.
//
// The thread is found by locating the proposal card carrying this actionId, and
// one update per action is allowed: a retry must not stack duplicate notices.
async function append(
  ctx: MutationCtx,
  ownerId: Id<"users">,
  actionId: Id<"agentActions">,
  content: string,
  attached?: { component: string; props: unknown }[],
) {
  const chats = await ctx.db.query("agentChats").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).collect();
  const chat = chats.find((candidate) => candidate.messages.some((message) =>
    message.cards?.some((card) =>
      card.props && typeof card.props === "object" && (card.props as { actionId?: unknown }).actionId === actionId,
    ),
  ));
  if (!chat || chat.messages.some((message) => message.actionId === actionId)) return false;

  await ctx.db.patch(chat._id, {
    messages: [...chat.messages, { role: "assistant" as const, content, actionId, cards: attached }],
    updatedAt: Date.now(),
  });
  return true;
}

// Image approvals, which run from the browser and report back with the owner's
// own identity.
export const appendActionUpdate = viewerMutation({
  args: { actionId: v.id("agentActions"), content: v.string(), cards },
  handler: async (ctx, { actionId, content, cards: attached }) => {
    requireOwner(ctx.viewer);
    return append(ctx, ctx.viewer._id, actionId, content, attached);
  },
});

// Translation approvals, which finish inside a scheduled action minutes later
// and therefore have no identity to run under — only the ownerId they were
// dispatched with. Same append, reached from the server side.
export const appendActionUpdateForOwner = internalMutation({
  args: { ownerId: v.id("users"), actionId: v.id("agentActions"), content: v.string(), cards },
  handler: async (ctx, { ownerId, actionId, content, cards: attached }) =>
    append(ctx, ownerId, actionId, content, attached),
});
