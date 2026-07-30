import { query } from "../../_generated/server";

// Public: the storefront reads the whole rate table once per page and converts
// every book client-side from it, rather than issuing a query per price.
export const list = query({
  args: {},
  handler: async (ctx) => ctx.db.query("fxRates").collect(),
});
