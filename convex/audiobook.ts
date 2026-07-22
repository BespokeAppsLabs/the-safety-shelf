"use node";
import { ConvexError, v } from "convex/values";
import { action, type ActionCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { api, internal } from "./_generated/api";
import { blocksToChapters } from "../lib/bookContent";
import { DEFAULT_ELEVENLABS_VOICE_ID, isElevenLabsModel, planNarration } from "../lib/elevenlabs";

// ElevenLabs audiobook pipeline. Explicit, owner-triggered (never auto) — each
// run spends real ElevenLabs credits. Content is narrated one request per
// chapter (each must fit the model's per-request char limit, enforced by
// planNarration); the returned MP3s are stored in Convex file storage and
// tracked in bookAudio. See docs/03-admin-agent.md and lib/elevenlabs.ts.
//
// The API key is read from the ELEVEN_LABS_API_KEY Convex env var (single-owner
// store), not a per-user credential row:
//   npx convex env set ELEVEN_LABS_API_KEY <key>
export const generate = action({
  args: {
    bookId: v.id("books"),
    model: v.string(),
    voiceId: v.optional(v.string()),
    // Language to narrate. Omitted or equal to the book's originalLang = the
    // original; any other must have a translated variant with content.
    lang: v.optional(v.string()),
  },
  handler: async (
    ctx: ActionCtx,
    { bookId, model, voiceId, lang },
  ): Promise<{ ok: true; chapters: number }> => {
    const viewer = await ctx.runQuery(api.users.getViewer, {});
    if (!viewer || viewer.role !== "owner") throw new ConvexError("Owner only");

    const apiKey = process.env.ELEVEN_LABS_API_KEY;
    if (!apiKey) throw new ConvexError("ELEVEN_LABS_API_KEY is not set on this deployment.");
    if (!isElevenLabsModel(model)) throw new ConvexError(`Unknown ElevenLabs model "${model}".`);

    const voice = voiceId?.trim() || process.env.ELEVEN_LABS_VOICE_ID || DEFAULT_ELEVENLABS_VOICE_ID;

    const book = await ctx.runQuery(api.books.getById, { bookId });
    if (!book) throw new ConvexError("Book not found");
    const targetLang = lang ?? book.originalLang;

    // Source text: the original blocks, or a translated variant's blocks.
    let blocks;
    if (targetLang === book.originalLang) {
      blocks = await ctx.runQuery(api.bookBlocks.listByBook, { bookId });
    } else {
      const variants = await ctx.runQuery(api.bookVariants.list, { bookId });
      const variant = variants.find((v) => v.lang === targetLang);
      if (!variant) throw new ConvexError(`No "${targetLang}" translation yet — translate the book first.`);
      blocks = await ctx.runQuery(api.variantBlocks.listByVariant, { variantId: variant._id });
    }

    const plan = planNarration(blocksToChapters(blocks), model);
    if (!plan.ok) throw new ConvexError(plan.error);

    await ctx.runMutation(internal.bookAudio.setStatus, { bookId, lang: targetLang, status: "generating" });
    try {
      const rows: { chapter: number; storageId: Id<"_storage">; chars: number }[] = [];
      for (const segment of plan.segments) {
        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, {
          method: "POST",
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
            Accept: "audio/mpeg",
          },
          body: JSON.stringify({ text: segment.text, model_id: model }),
        });
        if (!response.ok) {
          throw new Error(`ElevenLabs ${response.status}: ${(await response.text()).slice(0, 200)}`);
        }
        const audio = await response.blob();
        const storageId = await ctx.storage.store(audio);
        rows.push({ chapter: segment.chapter, storageId, chars: segment.text.length });
      }

      await ctx.runMutation(internal.bookAudio.replace, { bookId, lang: targetLang, model, voiceId: voice, rows });
      await ctx.runMutation(internal.bookAudio.setStatus, { bookId, lang: targetLang, status: "ready" });
      return { ok: true, chapters: rows.length };
    } catch (error) {
      await ctx.runMutation(internal.bookAudio.setStatus, { bookId, lang: targetLang, status: "failed" });
      throw new ConvexError(
        `Audiobook generation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  },
});
