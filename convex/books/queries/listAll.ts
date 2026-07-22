import { viewerQuery, requireOwner } from "../../lib/auth";

// Admin catalog table — every status, owner only.
export const listAll = viewerQuery({
  args: {},
  handler: async (ctx) => {
    requireOwner(ctx.viewer);
    return ctx.db.query("books").collect();
  },
});
