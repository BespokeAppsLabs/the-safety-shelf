"use node";
import { ConvexError, v } from "convex/values";
import { generateObject, NoObjectGeneratedError } from "ai";
import { z } from "zod";
import { action, internalAction, type ActionCtx } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { OPENROUTER_TRANSLATION_MODEL } from "./aiCredentials/providers";
import { decryptSecret } from "./lib/secrets";
import { openRouterClient } from "./lib/openrouter";
import { blocksToChapters, chaptersToBlocks, type Chapter } from "../lib/bookContent";
import { languageLabel } from "../lib/languages";
import { isSavedTranslation } from "../lib/translationState";

// Constrained decoding, not prose parsing: the schema goes to the provider as
// response_format, so a small local model physically cannot emit a dropped
// quote or a chatty preamble.
const translationMetaSchema = z.object({
  title: z.string(),
  blurb: z.string(),
});
const translatedChapterSchema = z.object({ heading: z.string(), paragraphs: z.array(z.string()) });

export function splitParagraphs(body: string) {
  return body.split(/\n\s*\n/).filter(Boolean);
}

// Translation is a constrained rewrite — same meaning, different language, a
// fixed schema. There is nothing to deliberate about, and on a reasoning model
// the deliberation is charged against the same output budget the JSON has to
// come out of, which is how a chapter call ends up returning no parseable
// object at all. The budget is raised instead of the effort pinned: sending
// reasoning_effort alongside provider.require_parameters narrows OpenRouter to
// endpoints supporting every one of response_format + json_schema + reasoning,
// and when that set came up empty the call failed earlier and harder —
// AI_APICallError: Invalid JSON response, from a non-JSON error body.
export const TRANSLATION_OPTIONS = {} as const;

// What to write in the trail when a call fails.
//
// `error.message` alone is not enough: an APICallError raised from a non-JSON
// body — a throttle page, a routing failure — can carry an empty message, and
// recording "" would produce an audit row stating that something went wrong and
// nothing about what. The status and the provider's own body are the parts that
// identify the fault, so they go in whenever they exist.
export function auditMessage(error: unknown) {
  if (!(error instanceof Error)) return String(error);
  const { statusCode, responseBody } = error as { statusCode?: number; responseBody?: string };
  return [
    error.message || error.name,
    statusCode ? `HTTP ${statusCode}` : null,
    responseBody ? responseBody.slice(0, 300) : null,
  ].filter(Boolean).join(" · ");
}

function ownerMessage(error: unknown) {
  if (NoObjectGeneratedError.isInstance(error)) {
    return error.finishReason === "length"
      ? "OpenRouter ran out of context before finishing a translation chapter. Split that chapter into shorter sections and retry."
      : "The translation model did not return usable text for a chapter. Retry — if it keeps failing, split that chapter into shorter sections.";
  }
  if (error instanceof ConvexError && typeof error.data === "string") return error.data;
  return "The translation could not be completed.";
}

// The owner's own click, from the admin Translations panel.
export const translate = action({
  args: { bookId: v.id("books"), lang: v.string() },
  handler: async (ctx: ActionCtx, { bookId, lang }): Promise<{ ok: true; chapters: number }> => {
    const viewer = await ctx.runQuery(api.users.getViewer, {});
    if (!viewer || viewer.role !== "owner") throw new ConvexError("Owner only");
    const runId = crypto.randomUUID();
    await ctx.runMutation(internal.translateData.reserveRun, { ownerId: viewer._id, bookId, lang, runId });
    try {
      return await ctx.runAction(internal.translate.runForOwner, { ownerId: viewer._id, bookId, lang, runId });
    } catch (error) {
      // runForOwner normally settles this itself. This also releases the lease
      // if crossing into the Node runtime failed before its handler began.
      try {
        await ctx.runMutation(internal.translateData.failRun, {
          ownerId: viewer._id,
          bookId,
          runId,
          reason: ownerMessage(error),
        });
      } catch { /* an expired lease is replaceable on the next attempt */ }
      throw error;
    }
  },
});

// LLM auto-translate: one structured response per chapter keeps output bounded
// and prevents a long book from being truncated before its closing JSON brace.
//
// Owner-scoped rather than identity-scoped, because it has two callers: the
// button above, and an approved translateBook proposal. The approval path runs
// through ctx.scheduler, and scheduled functions carry no auth identity — a
// getViewer here would return null and reject the owner's own approved action.
// Same reason aiCredentials and agentChats each expose a getForOwner.
export const runForOwner = internalAction({
  args: {
    ownerId: v.id("users"),
    bookId: v.id("books"),
    lang: v.string(),
    runId: v.string(),
    // Set when this run came from an approved translateBook proposal. The run
    // then reports its own outcome — the browser that clicked Approve is not
    // required to still be open minutes later for the chat to learn what
    // happened.
    actionId: v.optional(v.id("agentActions")),
  },
  handler: async (ctx: ActionCtx, { ownerId, bookId, lang, runId, actionId }): Promise<{ ok: true; chapters: number }> => {
    const viewer = { _id: ownerId };
    let audit: ((status: "ok" | "error", errorMessage?: string) => Promise<unknown>) | undefined;
    let bookTitle = "book";
    try {
      const credential = await ctx.runQuery(internal.aiCredentials.queries.getForOwner.getForOwner, { ownerId: viewer._id });
      if (!credential?.encryptedKey) throw new ConvexError("No OpenRouter key connected — set one up in Settings first.");

      // One owner-scoped read for everything this run needs. It also verifies
      // that this run still owns the book-level reservation.
      const loaded = await ctx.runQuery(internal.translateData.loadSource, { ownerId: viewer._id, bookId, runId });
      if (!loaded) throw new ConvexError("That book no longer exists.");
      const { book, variants, blocks } = loaded;
      bookTitle = book.title;
      if (variants.some((variant) => !isSavedTranslation(variant))) {
        throw new ConvexError("Save or discard the existing translation draft before generating another.");
      }

      const client = openRouterClient(decryptSecret(credential.encryptedKey));
      const source = {
        title: book.title,
        blurb: book.blurb,
        chapters: blocksToChapters(blocks).map(({ heading, body }) => ({ heading, paragraphs: splitParagraphs(body) })),
      };
      if (!source.chapters.length) throw new ConvexError("This book has no content to translate.");

      const start = Date.now();
      const usage = { inputTokens: 0, outputTokens: 0 };
      let servedModel: string = OPENROUTER_TRANSLATION_MODEL;
      audit = (status, errorMessage) => ctx.runMutation(internal.agentLogs.record, {
        role: "translator" as const,
        model: servedModel,
        subject: `${book.title} → ${lang}`,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        latencyMs: Date.now() - start,
        status,
        errorMessage,
      });

      const meta = await generateObject({
        model: client.chat(OPENROUTER_TRANSLATION_MODEL),
        schema: translationMetaSchema,
        maxOutputTokens: 1000,
        ...TRANSLATION_OPTIONS,
        prompt:
          `Translate this health & safety guide metadata into ${languageLabel(lang)} (${lang}). Keep the tone calm, plain, and non-alarmist.\n\n` +
          `Original:\n${JSON.stringify({ title: source.title, blurb: source.blurb })}`,
      });
      const translated = meta.object;
      servedModel = meta.response.modelId ?? servedModel;
      usage.inputTokens += meta.usage.inputTokens ?? 0;
      usage.outputTokens += meta.usage.outputTokens ?? 0;

      const translatedChapters: z.infer<typeof translatedChapterSchema>[] = [];
      for (const [index, chapter] of source.chapters.entries()) {
        if (!chapter.paragraphs.length) {
          translatedChapters.push({ heading: chapter.heading, paragraphs: [] });
          continue;
        }
        const result = await generateObject({
          model: client.chat(OPENROUTER_TRANSLATION_MODEL),
          schema: translatedChapterSchema,
          maxOutputTokens: 8000,
          ...TRANSLATION_OPTIONS,
          prompt:
            `Translate this one health & safety chapter into ${languageLabel(lang)} (${lang}). Keep the tone calm, plain, and non-alarmist. ` +
            `Return exactly ${chapter.paragraphs.length} translated paragraphs in the same order.\n\nOriginal chapter:\n${JSON.stringify(chapter)}`,
        });
        servedModel = result.response.modelId ?? servedModel;
        usage.inputTokens += result.usage.inputTokens ?? 0;
        usage.outputTokens += result.usage.outputTokens ?? 0;
        if (result.object.paragraphs.length !== chapter.paragraphs.length) {
          throw new ConvexError(`Translation chapter ${index + 1} changed the paragraph count. Please retry.`);
        }
        translatedChapters.push(result.object);
      }
      const chapters: Chapter[] = translatedChapters.map((chapter) => ({
        heading: chapter.heading,
        body: chapter.paragraphs.join("\n\n"),
      }));

      // Saving the draft, resolving the approval, and releasing the reservation
      // are one mutation. Either all three claims become true or none do.
      const variantId = await ctx.runMutation(internal.translateData.finishRun, {
        ownerId: viewer._id,
        bookId,
        lang,
        runId,
        actionId,
        title: translated.title,
        blurb: translated.blurb,
        blocks: chaptersToBlocks(chapters),
      });

      try { await audit("ok"); } catch { /* durable result already committed */ }
      if (actionId) {
        try {
          await ctx.runMutation(internal.agentChats.appendActionUpdateForOwner, {
            ownerId,
            actionId,
            content: `The ${languageLabel(lang)} translation of "${book.title}" is ready to review. Saving moves it into admin Content; reader delivery is not connected yet.`,
            cards: [{
              component: "TranslationReviewCard",
              props: {
                actionId,
                variantId,
                bookId,
                lang,
                language: languageLabel(lang),
                bookTitle: book.title,
                title: translated.title,
                blurb: translated.blurb,
                chapters: chapters.length,
              },
            }],
          });
        } catch { /* the approval card still reflects the executed status */ }
      }

      return { ok: true, chapters: chapters.length };
    } catch (error) {
      const reason = ownerMessage(error);
      try {
        await ctx.runMutation(internal.translateData.failRun, { ownerId, bookId, runId, actionId, reason });
      } catch { /* the scheduled expiry is the durable backstop */ }
      if (audit) {
        try { await audit("error", auditMessage(error)); } catch { /* settlement is more important than telemetry */ }
      }
      if (actionId) {
        try {
          const target = bookTitle === "book" ? "" : ` for "${bookTitle}"`;
          await ctx.runMutation(internal.agentChats.appendActionUpdateForOwner, {
            ownerId,
            actionId,
            content: `⚠ The ${languageLabel(lang)} translation failed${target}: ${reason}`,
          });
        } catch { /* the approval card still reflects the failed status */ }
      }
      throw new ConvexError(reason);
    }
  },
});
