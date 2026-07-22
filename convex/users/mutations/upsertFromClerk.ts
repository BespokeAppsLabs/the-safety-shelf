import { ConvexError, v } from "convex/values";
import { mutation } from "../../_generated/server";

// Called once after Clerk sign-in to sync the identity into `users`. New
// accounts default to "customer" — the single owner row is provisioned
// manually, never granted by self sign-up. clerkId is never taken from the
// client — it's the server-resolved identity subject, so there's nothing to
// spoof.
export const upsertFromClerk = mutation({
  args: { email: v.string(), name: v.string() },
  handler: async (ctx, { email, name }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");
    const clerkId = identity.subject;

    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId))
      .unique();

    if (existing) {
      if (existing.email !== email || existing.name !== name) {
        await ctx.db.patch(existing._id, { email, name });
      }
      return existing._id;
    }

    return ctx.db.insert("users", { clerkId, email, name, role: "customer" });
  },
});
