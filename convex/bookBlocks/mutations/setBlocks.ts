import { ConvexError, v } from "convex/values";
import { viewerMutation, requireOwner } from "../../lib/auth";

const blockArg = v.object({
  chapter: v.number(),
  ord: v.number(),
  type: v.union(v.literal("h"), v.literal("p"), v.literal("img")),
  text: v.optional(v.string()),
  imgStorageId: v.optional(v.id("_storage")),
});

// Full replace of a book's blocks — how writeBook (and translate/edit passes)
// write content. Simpler and safer than a diff/patch API for block lists.
export const setBlocks = viewerMutation({
  args: { bookId: v.id("books"), blocks: v.array(blockArg) },
  handler: async (ctx, { bookId, blocks }) => {
    requireOwner(ctx.viewer);

    const book = await ctx.db.get(bookId);
    if (!book) throw new ConvexError("Book not found");

    for (const block of blocks) {
      if (block.type === "img" && !block.imgStorageId) {
        throw new ConvexError("img block requires imgStorageId");
      }
      if (block.type !== "img" && !block.text) {
        throw new ConvexError(`${block.type} block requires text`);
      }
    }

    const existing = await ctx.db
      .query("bookBlocks")
      .withIndex("by_book", (q) => q.eq("bookId", bookId))
      .collect();
    for (const row of existing) await ctx.db.delete(row._id);

    for (const block of blocks) await ctx.db.insert("bookBlocks", { bookId, ...block });
  },
});
