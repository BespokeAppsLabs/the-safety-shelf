import { ConvexError, v } from "convex/values";
import { viewerMutation, requireOwner } from "../../lib/auth";
import type { MutationCtx } from "../../_generated/server";

// The owner's Approve click. Unlike decide (which only records the verdict for
// async executions), this runs the proposed write in the same transaction and
// marks it executed — so approval and effect are atomic. Execution is keyed by
// the stored tool name; the args were validated when the tool proposed, and
// are re-validated here against live DB state.
export const approveAndExecute = viewerMutation({
  args: { actionId: v.id("agentActions") },
  handler: async (ctx, { actionId }) => {
    requireOwner(ctx.viewer);

    const action = await ctx.db.get(actionId);
    if (!action) throw new ConvexError("Agent action not found");
    if (action.status !== "proposed") {
      throw new ConvexError(`Cannot approve an action in status "${action.status}"`);
    }

    // On success: executed + result. On failure the thrown error rolls the
    // whole transaction back (the row stays "proposed"), so the owner can
    // retry — no half-applied writes.
    const result = await runTool(ctx, action.tool, action.args);
    await ctx.db.patch(actionId, {
      status: "executed",
      decidedAt: Date.now(),
      decidedBy: ctx.viewer._id,
      result,
    });
    return result;
  },
});

function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "book"
  );
}

async function uniqueSlug(ctx: MutationCtx, title: string): Promise<string> {
  const base = slugify(title);
  let slug = base;
  let n = 1;
  while (await ctx.db.query("books").withIndex("by_slug", (q) => q.eq("slug", slug)).unique()) {
    slug = `${base}-${++n}`;
  }
  return slug;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runTool(ctx: MutationCtx, tool: string, args: any): Promise<unknown> {
  if (tool === "publishBook") {
    const book = await ctx.db.get(args.bookId);
    if (!book) throw new ConvexError("Book to publish no longer exists");
    await ctx.db.patch(args.bookId, { status: "live" });
    return { bookId: args.bookId, status: "live" };
  }

  if (tool === "writeBook") {
    const category = await ctx.db.get(args.categoryId);
    if (!category) throw new ConvexError("Category no longer exists");
    if (!(args.priceCents > 0)) throw new ConvexError("priceCents must be positive");

    const slug = await uniqueSlug(ctx, args.title);
    const bookId = await ctx.db.insert("books", {
      slug,
      title: args.title,
      author: args.author ?? "The Safety Shelf",
      priceCents: args.priceCents,
      status: "draft",
      categoryId: args.categoryId,
      ageGroup: args.ageGroup ?? "All ages",
      originalLang: "en",
      blurb: args.blurb,
    });

    const chapters: { heading: string; paragraphs: string[] }[] = args.chapters ?? [];
    for (let ci = 0; ci < chapters.length; ci++) {
      const chapter = ci + 1;
      await ctx.db.insert("bookBlocks", { bookId, chapter, ord: 0, type: "h", text: chapters[ci].heading });
      const paragraphs = chapters[ci].paragraphs ?? [];
      for (let pi = 0; pi < paragraphs.length; pi++) {
        await ctx.db.insert("bookBlocks", { bookId, chapter, ord: pi + 1, type: "p", text: paragraphs[pi] });
      }
    }
    return { bookId, slug, status: "draft" };
  }

  throw new ConvexError(`No executor wired for tool "${tool}"`);
}
