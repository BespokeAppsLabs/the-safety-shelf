import { ConvexError, v } from "convex/values";
import { viewerMutation, requireOwner } from "../../lib/auth";
import { assertUniqueTitle, setChapters } from "../../lib/books";
import type { Id } from "../../_generated/dataModel";
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
    // Re-checked at approval, not just when the tool proposed: a matching book
    // may have been created in between.
    await assertUniqueTitle(ctx, args.title);

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

    await setChapters(ctx, bookId, args.chapters ?? []);
    return { bookId, slug, status: "draft" };
  }

  // Edits an existing book in place — the same book, same slug, same buyers.
  // Only the fields the agent proposed are touched; chapters, when present,
  // replace the book's content wholesale.
  if (tool === "editBook") {
    const bookId = args.bookId as Id<"books">;
    const book = await ctx.db.get(bookId);
    if (!book) throw new ConvexError("Book to edit no longer exists");

    const patch: Record<string, unknown> = {};
    if (args.newTitle) {
      await assertUniqueTitle(ctx, args.newTitle, bookId);
      patch.title = args.newTitle;
    }
    if (args.blurb) patch.blurb = args.blurb;
    if (args.author) patch.author = args.author;
    if (args.ageGroup) patch.ageGroup = args.ageGroup;
    if (args.priceCents !== undefined) {
      if (!(args.priceCents > 0)) throw new ConvexError("priceCents must be positive");
      patch.priceCents = args.priceCents;
    }
    if (args.categoryId) {
      if (!(await ctx.db.get(args.categoryId))) throw new ConvexError("Category no longer exists");
      patch.categoryId = args.categoryId;
    }
    if (Object.keys(patch).length) await ctx.db.patch(bookId, patch);
    if (args.chapters) await setChapters(ctx, bookId, args.chapters);

    return {
      bookId,
      slug: book.slug,
      status: book.status,
      chapters: args.chapters ? args.chapters.length : undefined,
    };
  }

  throw new ConvexError(`No executor wired for tool "${tool}"`);
}
