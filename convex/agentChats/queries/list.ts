import { viewerQuery, requireOwner } from "../../lib/auth";
import { isAgentRunActive } from "../../../lib/agentRun";

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
        // Still generating — the rail shows a live dot so the owner can tell,
        // from any screen, that a session they walked away from is working.
        //
        // ponytail: bounded by wall clock rather than a heartbeat, because a
        // Convex action cannot outlive 10 minutes; a run killed mid-flight by a
        // deploy leaves the flag set and this is what expires it. The clock is
        // read at query time and queries are reactive to data, not to time, so
        // a stale badge can linger until the next write — cosmetic, and it
        // clears itself the moment anything touches the session.
        busy: isAgentRunActive(chat.runId, chat.runStartedAt),
      }));
  },
});
