import { query } from "../../_generated/server";

// Voice picklist for the audiobook generator. Public — it's a catalog, no key
// material. Alphabetical by name.
export const list = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("voices").collect();
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  },
});
