import { viewerQuery, requireOwner } from "../../lib/auth";

function mask(row: any) {
  return row ? {
    provider: row.provider,
    keyLast4: row.keyLast4,
    model: row.model,
    kind: row.kind,
    isActive: row.isActive,
    validatedAt: row.validatedAt,
  } : null;
}

export const getStatus = viewerQuery({
  args: {},
  handler: async (ctx) => {
    requireOwner(ctx.viewer);
    const rows = await ctx.db.query("aiCredentials").withIndex("by_owner", (q) => q.eq("ownerId", ctx.viewer._id)).collect();
    return {
      text: mask(rows.find((row) => (row.purpose ?? "text") === "text" && row.isActive)),
      image: mask(rows.find((row) => row.purpose === "image" && row.isActive)),
    };
  },
});
