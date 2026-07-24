"use node";
import { ConvexError, v } from "convex/values";
import { generateObject, NoObjectGeneratedError } from "ai";
import { z } from "zod";
import { action, type ActionCtx } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { OPENROUTER_TEXT_MODEL } from "./aiCredentials/providers";
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

// LLM auto-translate: one structured response per chapter keeps output bounded
// and prevents a long book from being truncated before its closing JSON brace.
export const translate = action({
  args: { bookId: v.id("books"), lang: v.string() },
  handler: async (ctx: ActionCtx, { bookId, lang }): Promise<{ ok: true; chapters: number }> => {
    const viewer = await ctx.runQuery(api.users.getViewer, {});
    if (!viewer || viewer.role !== "owner") throw new ConvexError("Owner only");

    const credential = await ctx.runQuery(internal.aiCredentials.queries.getForOwner.getForOwner, { ownerId: viewer._id });
    if (!credential?.encryptedKey) throw new ConvexError("No OpenRouter key connected — set one up in Settings first.");

    const book = await ctx.runQuery(api.books.getById, { bookId });
    if (!book) throw new ConvexError("Book not found");

    const variants = await ctx.runQuery(api.bookVariants.list, { bookId });
    if (variants.some((variant) => !isSavedTranslation(variant))) {
      throw new ConvexError("Save the current translation before generating another.");
    }

    const client = openRouterClient(decryptSecret(credential.encryptedKey));

    const blocks = await ctx.runQuery(api.bookBlocks.listByBook, { bookId });
    // Text only — the image fields on a chapter are prompt bloat the model
    // must not see (or echo back).
    const source = {
      title: book.title,
      blurb: book.blurb,
      chapters: blocksToChapters(blocks).map(({ heading, body }) => ({ heading, paragraphs: splitParagraphs(body) })),
    };
    if (!source.chapters.length) throw new ConvexError("This book has no content to translate.");

    let translated: z.infer<typeof translationMetaSchema>;
    let translatedChapters: z.infer<typeof translatedChapterSchema>[] = [];
    try {
      ({ object: translated } = await generateObject({
        model: client.chat(OPENROUTER_TEXT_MODEL),
        schema: translationMetaSchema,
        maxOutputTokens: 500,
        prompt:
          `Translate this health & safety guide metadata into ${languageLabel(lang)} (${lang}). Keep the tone calm, plain, and non-alarmist.\n\n` +
          `Original:\n${JSON.stringify({ title: source.title, blurb: source.blurb })}`,
      }));
      translatedChapters = [];
      for (const [index, chapter] of source.chapters.entries()) {
        if (!chapter.paragraphs.length) {
          translatedChapters.push({ heading: chapter.heading, paragraphs: [] });
          continue;
        }
        const { object } = await generateObject({
          model: client.chat(OPENROUTER_TEXT_MODEL),
          schema: translatedChapterSchema,
          maxOutputTokens: 4000,
          prompt:
            `Translate this one health & safety chapter into ${languageLabel(lang)} (${lang}). Keep the tone calm, plain, and non-alarmist. ` +
            `Return exactly ${chapter.paragraphs.length} translated paragraphs in the same order.\n\nOriginal chapter:\n${JSON.stringify(chapter)}`,
        });
        if (object.paragraphs.length !== chapter.paragraphs.length) {
          throw new ConvexError(`Translation chapter ${index + 1} changed the paragraph count. Please retry.`);
        }
        translatedChapters.push(object);
      }
    } catch (error) {
      // A thinking model that runs out of context spends its whole budget
      // reasoning and returns an empty message — the symptom is "length".
      if (NoObjectGeneratedError.isInstance(error) && error.finishReason === "length") {
        throw new ConvexError(
          `OpenRouter ran out of context before finishing a translation chapter. Split that chapter into shorter sections and retry.`,
        );
      }
      throw error;
    }

    const chapters: Chapter[] = translatedChapters.map((chapter) => ({
      heading: chapter.heading,
      body: chapter.paragraphs.join("\n\n"),
    }));

    const existing = variants.find((variant) => variant.lang === lang);
    const variantId = existing
      ? (await ctx.runMutation(api.bookVariants.update, {
          variantId: existing._id,
          title: translated.title,
          blurb: translated.blurb,
          isSaved: false,
        }),
        existing._id)
      : await ctx.runMutation(api.bookVariants.create, {
          bookId,
          lang,
          title: translated.title,
          blurb: translated.blurb,
        });

    await ctx.runMutation(api.variantBlocks.setBlocks, {
      variantId,
      blocks: chaptersToBlocks(chapters),
    });

    return { ok: true, chapters: chapters.length };
  },
});
