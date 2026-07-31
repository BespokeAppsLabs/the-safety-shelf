import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { chaptersToBlocks, paragraphChaptersToEditor, type ParagraphChapter } from "../../lib/bookContent";

// A book's title is its human identity in the catalog, the agent's only handle
// on it (every tool matches by title), and what the storefront shows. Two books
// sharing one is how the agent ended up creating a second "Pregnancy Safety
// Basics" instead of editing the first: slugs auto-suffix, so nothing objected.
// Guarded here rather than at each call site so every path that can name a book
// — books.create, books.update, and the writeBook/editBook executors — is
// covered by one rule.
export function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// ponytail: full scan, no by_title index — the catalog is tens of books. Add
// the index if it ever gets big enough to notice.
export async function assertUniqueTitle(
  ctx: MutationCtx,
  title: string,
  exceptBookId?: Id<"books">,
): Promise<void> {
  const needle = normalizeTitle(title);
  const books = await ctx.db.query("books").collect();
  const clash = books.find((book) => book._id !== exceptBookId && normalizeTitle(book.title) === needle);
  if (clash) {
    throw new ConvexError(
      `A ${clash.status} book titled "${clash.title}" already exists. Edit that book instead of creating a second one.`,
    );
  }
}

// Full replace of a book's content, same contract as bookBlocks.setBlocks —
// used by the writeBook and editBook executors so both write chapters through
// one code path.
export async function setChapters(
  ctx: MutationCtx,
  bookId: Id<"books">,
  chapters: ParagraphChapter[],
): Promise<void> {
  const existing = await ctx.db
    .query("bookBlocks")
    .withIndex("by_book", (q) => q.eq("bookId", bookId))
    .collect();
  for (const row of existing) await ctx.db.delete(row._id);

  for (const block of chaptersToBlocks(paragraphChaptersToEditor(chapters))) {
    await ctx.db.insert("bookBlocks", { bookId, ...block });
  }
}
