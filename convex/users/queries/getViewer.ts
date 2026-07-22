import { query } from "../../_generated/server";

// Null-safe: unlike viewerQuery, this must not throw for a signed-out visitor
// or a signed-in-but-not-yet-synced Clerk user.
export const getViewer = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    return ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
  },
});
