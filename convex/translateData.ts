import { ConvexError, v } from "convex/values";
import { internalQuery, internalMutation } from "./_generated/server";
import { isTranslationRunActive, reserveTranslationRun } from "./lib/translationRun";

/**
 * The reads and writes a translation run needs, owner-scoped.
 *
 * translate.runForOwner used to reach for the public `books.getById`,
 * `bookVariants.list`, `bookBlocks.listByBook`, `bookVariants.create/update`
 * and `variantBlocks.setBlocks`. Every one of those is a viewerQuery /
 * viewerMutation resolving the caller's Clerk identity — fine from the browser,
 * fatal from the scheduler, which runs with no identity at all. An approved
 * translation therefore died 20ms in with "Not authenticated", before a single
 * provider call, and the proposal sat at "approved" forever.
 *
 * Passing ownerId through was not enough on its own: it has to be honoured all
 * the way down. These functions keep reservation, reads, writes, and settlement
 * behind that same owner boundary.
 */

// The ownerId originates from an authenticated caller (the panel's action, or
// approveAndExecute's requireOwner). Re-checked here anyway: this is the trust
// boundary for functions that no longer have an identity to lean on.
async function requireOwnerId(ctx: { db: { get: (id: any) => Promise<any> } }, ownerId: unknown) {
  const user = await ctx.db.get(ownerId);
  if (!user || user.role !== "owner") throw new ConvexError("Owner only");
}

export const loadSource = internalQuery({
  args: { ownerId: v.id("users"), bookId: v.id("books"), runId: v.string() },
  handler: async (ctx, { ownerId, bookId, runId }) => {
    await requireOwnerId(ctx, ownerId);

    const book = await ctx.db.get(bookId);
    if (!book) return null;
    if (book.translationRun?.runId !== runId) throw new ConvexError("This translation run is no longer active.");

    const [variants, blocks] = await Promise.all([
      ctx.db.query("bookVariants").withIndex("by_book", (q) => q.eq("bookId", bookId)).collect(),
      ctx.db.query("bookBlocks").withIndex("by_book", (q) => q.eq("bookId", bookId)).collect(),
    ]);
    // No storage URLs: translation reads text only, and the image fields are
    // prompt bloat the model must never see.
    return { book: { title: book.title, blurb: book.blurb, originalLang: book.originalLang }, variants, blocks };
  },
});

export const reserveRun = internalMutation({
  args: { ownerId: v.id("users"), bookId: v.id("books"), lang: v.string(), runId: v.string() },
  handler: async (ctx, { ownerId, bookId, lang, runId }) => {
    await requireOwnerId(ctx, ownerId);
    await reserveTranslationRun(ctx, bookId, lang, runId);
  },
});

// Stores the usable draft, resolves its approval, and releases the book in one
// transaction. A failure commits none of those claims.
export const finishRun = internalMutation({
  args: {
    ownerId: v.id("users"),
    bookId: v.id("books"),
    lang: v.string(),
    runId: v.string(),
    actionId: v.optional(v.id("agentActions")),
    title: v.string(),
    blurb: v.string(),
    blocks: v.array(v.object({
      chapter: v.number(),
      ord: v.number(),
      type: v.union(v.literal("h"), v.literal("p"), v.literal("img")),
      text: v.optional(v.string()),
      imgStorageId: v.optional(v.id("_storage")),
    })),
  },
  handler: async (ctx, { ownerId, bookId, lang, runId, actionId, title, blurb, blocks }) => {
    await requireOwnerId(ctx, ownerId);
    const book = await ctx.db.get(bookId);
    if (!book || book.translationRun?.runId !== runId) {
      throw new ConvexError("This translation run is no longer active.");
    }

    const existing = await ctx.db
      .query("bookVariants")
      .withIndex("by_book_lang", (q) => q.eq("bookId", bookId).eq("lang", lang))
      .unique();

    // Re-translating a language reuses its row and drops back to unsaved, so a
    // regenerated draft can never masquerade as reviewed content.
    const variantId = existing?._id
      ?? (await ctx.db.insert("bookVariants", { bookId, lang, status: "draft", title, blurb, isSaved: false }));
    if (existing) await ctx.db.patch(variantId, { title, blurb, isSaved: false });

    const stale = await ctx.db
      .query("variantBlocks")
      .withIndex("by_variant", (q) => q.eq("variantId", variantId))
      .collect();
    for (const row of stale) await ctx.db.delete(row._id);
    for (const block of blocks) await ctx.db.insert("variantBlocks", { variantId, ...block });

    if (actionId) {
      const action = await ctx.db.get(actionId);
      if (!action || action.status !== "approved") throw new ConvexError("Translation approval is no longer active.");
      await ctx.db.patch(actionId, { status: "executed", result: { variantId, lang, chapters: new Set(blocks.map((block) => block.chapter)).size } });
    }
    await ctx.db.patch(bookId, { translationRun: undefined });

    return variantId;
  },
});

export const failRun = internalMutation({
  args: {
    ownerId: v.id("users"),
    bookId: v.id("books"),
    runId: v.string(),
    actionId: v.optional(v.id("agentActions")),
    reason: v.string(),
  },
  handler: async (ctx, { ownerId, bookId, runId, actionId, reason }) => {
    await requireOwnerId(ctx, ownerId);
    const book = await ctx.db.get(bookId);
    if (book?.translationRun?.runId === runId) await ctx.db.patch(bookId, { translationRun: undefined });
    if (actionId) {
      const action = await ctx.db.get(actionId);
      if (action?.status === "approved") await ctx.db.patch(actionId, { status: "failed", result: { error: reason } });
    }
  },
});

// Durable backstop for a Node action killed at its ten-minute runtime limit.
export const expireRun = internalMutation({
  args: { bookId: v.id("books"), runId: v.string(), actionId: v.optional(v.id("agentActions")) },
  handler: async (ctx, { bookId, runId, actionId }) => {
    const book = await ctx.db.get(bookId);
    let changed = false;
    if (book?.translationRun?.runId === runId && !isTranslationRunActive(book.translationRun)) {
      await ctx.db.patch(bookId, { translationRun: undefined });
      changed = true;
    }
    if (actionId) {
      const action = await ctx.db.get(actionId);
      if (action?.status === "approved") {
        await ctx.db.patch(actionId, { status: "failed", result: { error: "Translation timed out before completion." } });
        changed = true;
      }
    }
    return changed;
  },
});
