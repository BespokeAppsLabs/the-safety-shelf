"use node";
import { ConvexError, v } from "convex/values";
import { action, type ActionCtx } from "./_generated/server";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { imageModel } from "../lib/imageModels";
import { decryptSecret } from "./lib/secrets";
import { higgsfieldAccessToken } from "./lib/higgsfieldAuth";
import { HiggsfieldSession, higgsfieldGenerate, downloadHiggsfieldImage } from "./lib/higgsfield";

async function imageCredential(ctx: ActionCtx) {
  const viewer = await ctx.runQuery(api.users.getViewer, {});
  if (!viewer || viewer.role !== "owner") throw new ConvexError("Owner only");
  const credential = await ctx.runQuery(internal.aiCredentials.queries.getForOwner.getForOwner, {
    ownerId: viewer._id,
    purpose: "image",
  });
  if (!credential) throw new ConvexError("No image provider connected — add a separate image provider in Settings first.");
  if (!credential.encryptedKey) throw new ConvexError("Image credential is missing — connect the image provider again.");
  // Higgsfield tokens are short-lived OAuth access tokens: refresh before use.
  const apiKey = credential.provider === "higgsfield"
    ? await higgsfieldAccessToken(ctx, credential)
    : decryptSecret(credential.encryptedKey);
  return { provider: credential.provider, apiKey };
}

async function generateOpenAI(apiKey: string, model: string, prompt: string): Promise<Blob> {
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt, size: "1024x1024" }),
  });
  const json = (await res.json().catch(() => ({}))) as { data?: Array<{ b64_json?: string }>; error?: { message?: string } };
  if (!res.ok) throw new ConvexError(`OpenAI image generation failed: ${json.error?.message ?? res.statusText}`);
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new ConvexError("OpenAI returned no image bytes.");
  return new Blob([Buffer.from(b64, "base64")], { type: "image/png" });
}

async function generateStability(apiKey: string, prompt: string): Promise<Blob> {
  const form = new FormData();
  form.set("prompt", prompt);
  form.set("output_format", "png");
  form.set("aspect_ratio", "1:1");
  const res = await fetch("https://api.stability.ai/v2beta/stable-image/generate/core", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, Accept: "image/*" },
    body: form,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new ConvexError(`Stability image generation failed: ${text.slice(0, 300)}`);
  }
  return res.blob();
}

async function generateHiggsfield(token: string, modelId: string, prompt: string): Promise<Blob> {
  const model = imageModel(modelId);
  if (!("higgsfieldModel" in model) || !model.higgsfieldModel) {
    throw new ConvexError(`Image model "${modelId}" is not a Higgsfield model.`);
  }
  const session = await HiggsfieldSession.open(token);
  const url = await higgsfieldGenerate(session, {
    model: model.higgsfieldModel,
    prompt,
    aspect_ratio: "1:1",
    ...model.higgsfieldParams,
  });
  return downloadHiggsfieldImage(url);
}

async function generateImage(apiKey: string | undefined, provider: string, modelId: string, prompt: string): Promise<Blob> {
  if (provider === "openai" && apiKey) return generateOpenAI(apiKey, modelId, prompt);
  if (provider === "stability" && apiKey) return generateStability(apiKey, prompt);
  if (provider === "higgsfield" && apiKey) return generateHiggsfield(apiKey, modelId, prompt);
  throw new ConvexError(`No image adapter wired for provider "${provider}".`);
}

const args = { bookId: v.id("books"), modelId: v.string(), prompt: v.optional(v.string()) };

export const generateCover = action({
  args,
  handler: async (ctx, { bookId, modelId, prompt }): Promise<{ storageId: Id<"_storage">; url: string | null; estimateCents: number }> => {
    const [credential, book] = await Promise.all([imageCredential(ctx), ctx.runQuery(api.books.getById, { bookId })]);
    if (!book) throw new ConvexError("Book not found");
    const model = imageModel(modelId);
    if (model.provider !== credential.provider) throw new ConvexError(`Selected model belongs to ${model.provider}, but the connected image provider is ${credential.provider}.`);
    const finalPrompt = prompt?.trim() || `Square professional digital book cover for The Safety Shelf. Title: ${book.title}. Topic: ${book.blurb}. Safety-first editorial illustration, clean shelf/shield motif, no small body text.`;
    const storageId = await ctx.storage.store(await generateImage(credential.apiKey, credential.provider, model.id, finalPrompt));
    await ctx.runMutation(internal.imageMutations.setCover, { bookId, storageId });
    return { storageId, url: await ctx.storage.getUrl(storageId), estimateCents: model.estimateCents };
  },
});

export const generateChapterImage = action({
  args: { ...args, chapter: v.number() },
  handler: async (ctx, { bookId, chapter, modelId, prompt }): Promise<{ storageId: Id<"_storage">; url: string | null; estimateCents: number }> => {
    const [credential, book, blocks] = await Promise.all([
      imageCredential(ctx),
      ctx.runQuery(api.books.getById, { bookId }),
      ctx.runQuery(api.bookBlocks.listByBook, { bookId }),
    ]);
    if (!book) throw new ConvexError("Book not found");
    const model = imageModel(modelId);
    if (model.provider !== credential.provider) throw new ConvexError(`Selected model belongs to ${model.provider}, but the connected image provider is ${credential.provider}.`);
    const chapterText = blocks.filter((b) => b.chapter === chapter && b.type !== "img").map((b) => b.text).filter(Boolean).join("\n");
    const finalPrompt = prompt?.trim() || `Square safety guide illustration for "${book.title}", chapter ${chapter}. Reflect this content: ${chapterText.slice(0, 900)}. Warm, clear, educational, diverse people, no text overlays.`;
    const storageId = await ctx.storage.store(await generateImage(credential.apiKey, credential.provider, model.id, finalPrompt));
    await ctx.runMutation(internal.imageMutations.setChapterImage, { bookId, chapter, storageId });
    return { storageId, url: await ctx.storage.getUrl(storageId), estimateCents: model.estimateCents };
  },
});
