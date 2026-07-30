import { query } from "../../_generated/server";

// Public: the storefront needs the base currency to render any price at all.
// Returns null before the owner has configured one — callers must treat that as
// "prices not ready", never as a default currency.
export const get = query({
  args: {},
  handler: async (ctx) => ctx.db.query("storeSettings").first(),
});
