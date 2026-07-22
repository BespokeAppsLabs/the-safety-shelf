// One-off admin seeding tool — not part of the public api.*, only callable via
// `npx convex run promoteOwner:promoteOwner '{"email":"..."}'`. This is the
// only way a user ever becomes "owner"; upsertFromClerk always defaults new
// accounts to "customer".
import { ConvexError, v } from "convex/values";
import { internalMutation } from "./_generated/server";

export const promoteOwner = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (!user) throw new ConvexError(`No user with email "${email}" — sign in first, then run this.`);

    await ctx.db.patch(user._id, { role: "owner" });
    return user._id;
  },
});
