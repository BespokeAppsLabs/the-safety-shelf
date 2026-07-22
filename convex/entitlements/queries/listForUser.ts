import { viewerQuery } from "../../lib/auth";

// My Library — the signed-in reader's own purchased books. Revoked
// entitlements (refunds) are excluded.
export const listForUser = viewerQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("entitlements")
      .withIndex("by_user", (q) => q.eq("userId", ctx.viewer._id))
      .collect();

    const books = await Promise.all(
      rows
        .filter((row) => !row.revokedAt)
        .map((row) => ctx.db.get(row.bookId)),
    );
    return books.filter((book) => book !== null);
  },
});
