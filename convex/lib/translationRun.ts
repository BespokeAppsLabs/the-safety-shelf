import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { isSavedTranslation } from "../../lib/translationState";

export const TRANSLATION_RUN_TIMEOUT_MS = 10 * 60 * 1000;

export function isTranslationRunActive(
  run?: { startedAt: number },
  now = Date.now(),
) {
  return Boolean(run && now - run.startedAt < TRANSLATION_RUN_TIMEOUT_MS);
}

export async function reserveTranslationRun(
  ctx: MutationCtx,
  bookId: Id<"books">,
  lang: string,
  runId: string,
  now = Date.now(),
) {
  const book = await ctx.db.get(bookId);
  if (!book) throw new ConvexError("That book no longer exists.");
  if (isTranslationRunActive(book.translationRun, now)) {
    throw new ConvexError(`A translation of "${book.title}" is already running.`);
  }

  const variants = await ctx.db
    .query("bookVariants")
    .withIndex("by_book", (q) => q.eq("bookId", bookId))
    .collect();
  if (variants.some((variant) => !isSavedTranslation(variant))) {
    throw new ConvexError("Save or discard the existing translation draft before generating another.");
  }

  await ctx.db.patch(bookId, { translationRun: { runId, lang, startedAt: now } });
}
