"use node";
import { ConvexError, v } from "convex/values";
import { generateObject, NoObjectGeneratedError } from "ai";
import { z } from "zod";
import { createOpenAI } from "@ai-sdk/openai";
import { action, type ActionCtx } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { PROVIDER_DEFAULTS } from "./aiCredentials/providers";
import { decryptSecret } from "./lib/secrets";
import { blocksToChapters, chaptersToBlocks, type Chapter } from "../lib/bookContent";
import { languageLabel } from "../lib/languages";

// Constrained decoding, not prose parsing: the schema goes to the provider as
// response_format, so a small local model physically cannot emit a dropped
// quote or a chatty preamble.
const translationSchema = z.object({
  title: z.string(),
  blurb: z.string(),
  chapters: z.array(z.object({ heading: z.string(), paragraphs: z.array(z.string()) })),
});

// LLM auto-translate: reads the original book, produces a translated variant as
// a DRAFT the owner can edit before publishing. Uses the connected BYOK
// provider, same client as the agent. ponytail: whole book in one call — chunk
// per chapter if a book ever overflows the model's context.
export const translate = action({
  args: { bookId: v.id("books"), lang: v.string() },
  handler: async (ctx: ActionCtx, { bookId, lang }): Promise<{ ok: true; chapters: number }> => {
    const viewer = await ctx.runQuery(api.users.getViewer, {});
    if (!viewer || viewer.role !== "owner") throw new ConvexError("Owner only");

    const credential = await ctx.runQuery(internal.aiCredentials.queries.getForOwner.getForOwner, {
      ownerId: viewer._id,
      purpose: "text",
    });
    if (!credential) throw new ConvexError("No AI provider connected — set one up in Settings first.");

    const book = await ctx.runQuery(api.books.getById, { bookId });
    if (!book) throw new ConvexError("Book not found");

    const apiKey = credential.provider === "ollama" ? "ollama-local" : decryptSecret(credential.encryptedKey!);
    const modelId = credential.model ?? PROVIDER_DEFAULTS[credential.provider].model;
    const client = createOpenAI({ apiKey, baseURL: credential.baseURL });

    const blocks = await ctx.runQuery(api.bookBlocks.listByBook, { bookId });
    // Text only — the image fields on a chapter are prompt bloat the model
    // must not see (or echo back).
    const source = {
      title: book.title,
      blurb: book.blurb,
      chapters: blocksToChapters(blocks).map(({ heading, body }) => ({ heading, body })),
    };
    if (!source.chapters.length) throw new ConvexError("This book has no content to translate.");

    // generateObject reads the message channel only — a thinking model's
    // reasoning never reaches `object`, and the schema rides along as
    // response_format so the reply is constrained JSON, not parsed prose.
    let translated: z.infer<typeof translationSchema>;
    try {
      ({ object: translated } = await generateObject({
        model: client.chat(modelId),
        schema: translationSchema,
        // Thinking and constrained JSON decoding fight each other on Ollama:
        // with both on, gemma4 emitted structural fragments ("]") as prose and
        // stopped at chapter 2 of 6. Off, the same book comes back complete in
        // ~90s. Ollama-only — OpenAI rejects reasoning_effort on its
        // non-reasoning models.
        providerOptions: credential.provider === "ollama" ? { openai: { reasoningEffort: "none" } } : undefined,
        prompt:
          `Translate this health & safety guide into ${languageLabel(lang)} (${lang}). Keep the tone calm, plain, and ` +
          `non-alarmist. Preserve the chapter and paragraph structure exactly — one paragraph in, one paragraph out.\n\n` +
          `Original:\n${JSON.stringify(source)}`,
      }));
    } catch (error) {
      // A thinking model that runs out of context spends its whole budget
      // reasoning and returns an empty message — the symptom is "length".
      if (NoObjectGeneratedError.isInstance(error) && error.finishReason === "length") {
        throw new ConvexError(
          `${modelId} ran out of context before finishing the translation. Raise the model's context window ` +
            `(Ollama: OLLAMA_CONTEXT_LENGTH, default 4096) or translate a shorter book.`,
        );
      }
      throw error;
    }

    const chapters: Chapter[] = translated.chapters.map((chapter) => ({
      heading: chapter.heading,
      body: chapter.paragraphs.join("\n\n"),
    }));

    const variants = await ctx.runQuery(api.bookVariants.list, { bookId });
    const existing = variants.find((variant) => variant.lang === lang);
    const variantId = existing
      ? (await ctx.runMutation(api.bookVariants.update, {
          variantId: existing._id,
          title: translated.title,
          blurb: translated.blurb,
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
