"use node";
import { ConvexError, v } from "convex/values";
import { action, type ActionCtx } from "./_generated/server";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { decryptSecret } from "./lib/secrets";
import { OPENROUTER_BASE_URL, OPENROUTER_IMAGE_MODEL } from "./aiCredentials/providers";

type ImageResult = { image: Blob; costUsd: number | null };

async function imageCredential(ctx: ActionCtx) {
  const viewer = await ctx.runQuery(api.users.getViewer, {});
  if (!viewer || viewer.role !== "owner") throw new ConvexError("Owner only");
  const credential = await ctx.runQuery(internal.aiCredentials.queries.getForOwner.getForOwner, { ownerId: viewer._id });
  if (!credential?.encryptedKey) throw new ConvexError("No OpenRouter key connected — add it in Settings first.");
  return decryptSecret(credential.encryptedKey);
}

export async function generateOpenRouterImage(apiKey: string, prompt: string): Promise<ImageResult> {
  const res = await fetch(`${OPENROUTER_BASE_URL}/images`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: OPENROUTER_IMAGE_MODEL, prompt, aspect_ratio: "1:1" }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    data?: Array<{ b64_json?: string; media_type?: string }>;
    usage?: { cost?: number };
    error?: { message?: string };
  };
  if (!res.ok) throw new ConvexError(`OpenRouter image generation failed: ${json.error?.message ?? res.statusText}`);
  const image = json.data?.[0];
  if (!image?.b64_json) throw new ConvexError("OpenRouter returned no image bytes.");
  return {
    image: new Blob([Buffer.from(image.b64_json, "base64")], { type: image.media_type ?? "image/png" }),
    costUsd: typeof json.usage?.cost === "number" ? json.usage.cost : null,
  };
}

const args = { bookId: v.id("books"), prompt: v.optional(v.string()) };
type GenerationResponse = { storageId: Id<"_storage">; url: string | null; actualCostUsd: number | null };

export const generateCover = action({
  args,
  handler: async (ctx, { bookId, prompt }): Promise<GenerationResponse> => {
    const [apiKey, book] = await Promise.all([imageCredential(ctx), ctx.runQuery(api.books.getById, { bookId })]);
    if (!book) throw new ConvexError("Book not found");
    const finalPrompt = prompt?.trim() || `Square professional digital book cover for The Safety Shelf. Title: ${book.title}. Topic: ${book.blurb}. Safety-first editorial illustration, clean shelf/shield motif, no small body text.`;
    const result = await generateOpenRouterImage(apiKey, finalPrompt);
    const storageId = await ctx.storage.store(result.image);
    await ctx.runMutation(internal.imageMutations.setCover, { bookId, storageId });
    return { storageId, url: await ctx.storage.getUrl(storageId), actualCostUsd: result.costUsd };
  },
});

export const generateChapterImage = action({
  args: { ...args, chapter: v.number() },
  handler: async (ctx, { bookId, chapter, prompt }): Promise<GenerationResponse> => {
    const [apiKey, book, blocks] = await Promise.all([
      imageCredential(ctx),
      ctx.runQuery(api.books.getById, { bookId }),
      ctx.runQuery(api.bookBlocks.listByBook, { bookId }),
    ]);
    if (!book) throw new ConvexError("Book not found");
    const chapterText = blocks.filter((b) => b.chapter === chapter && b.type !== "img").map((b) => b.text).filter(Boolean).join("\n");
    const finalPrompt = prompt?.trim() || `Square safety guide illustration for "${book.title}", chapter ${chapter}. Reflect this content: ${chapterText.slice(0, 900)}. Warm, clear, educational, diverse people, no text overlays.`;
    const result = await generateOpenRouterImage(apiKey, finalPrompt);
    const storageId = await ctx.storage.store(result.image);
    await ctx.runMutation(internal.imageMutations.setChapterImage, { bookId, chapter, storageId });
    return { storageId, url: await ctx.storage.getUrl(storageId), actualCostUsd: result.costUsd };
  },
});
