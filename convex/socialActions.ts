"use node";
import { ConvexError, v } from "convex/values";
import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { action, type ActionCtx } from "./_generated/server";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { PROVIDER_DEFAULTS } from "./aiCredentials/providers";
import { decryptSecret } from "./lib/secrets";
import { socialPlatform, SOCIAL_PLATFORM_VALUES } from "../lib/social";

async function ownerViewer(ctx: ActionCtx) {
  const viewer = await ctx.runQuery(api.users.getViewer, {});
  if (!viewer || viewer.role !== "owner") throw new ConvexError("Owner only");
  return viewer;
}

// Text client, same construction as convex/agent.ts (the store's connected
// text provider — OpenAI or any OpenAI-compatible endpoint).
async function textClient(ctx: ActionCtx, ownerId: Id<"users">) {
  const credential = await ctx.runQuery(internal.aiCredentials.queries.getForOwner.getForOwner, {
    ownerId,
    purpose: "text",
  });
  if (!credential) throw new ConvexError("No text AI provider connected — set one up in Settings first.");
  const apiKey = credential.provider === "ollama" ? "ollama-local" : decryptSecret(credential.encryptedKey!);
  const modelId = credential.model ?? PROVIDER_DEFAULTS[credential.provider].model;
  const client = createOpenAI({ apiKey, baseURL: credential.baseURL });
  return { model: client.chat(modelId), modelId };
}

async function writeCopy(
  ctx: ActionCtx,
  ownerId: Id<"users">,
  platform: string,
  book: { title: string; author: string; blurb: string; slug: string },
  instructions?: string,
): Promise<string> {
  const meta = socialPlatform(platform);
  const { model } = await textClient(ctx, ownerId);
  const storeUrl = `${process.env.STORE_PUBLIC_URL ?? "https://thesafetyshelf.com"}/book/${book.slug}`;
  const { text } = await generateText({
    model,
    system:
      "You are the social media manager for The Safety Shelf, a digital bookstore of safety-first guides and storybooks. " +
      "Write a single ready-to-post caption. Output only the caption text — no preamble, no quotes, no markdown headers.",
    prompt:
      `Platform: ${meta?.label ?? platform}\nStyle: ${meta?.guidance ?? "Clear and friendly."}\n\n` +
      `Book: "${book.title}" by ${book.author}\nAbout: ${book.blurb}\nStore link: ${storeUrl}\n\n` +
      (instructions ? `Extra instructions from the owner: ${instructions}\n\n` : "") +
      "Write the caption now. Include the store link.",
  });
  return text.trim();
}

// Draft one post per selected platform. Attaches the book's existing cover as
// media (no new image credits) so the preview and publish carry the artwork.
export const generateSocialPost = action({
  args: {
    bookId: v.id("books"),
    platforms: v.array(v.string()),
    instructions: v.optional(v.string()),
  },
  handler: async (ctx, { bookId, platforms, instructions }): Promise<{ postIds: Id<"socialPosts">[] }> => {
    const viewer = await ownerViewer(ctx);
    const book = await ctx.runQuery(internal.social.bookForSocial, { bookId });
    if (!book) throw new ConvexError("Book not found");

    const chosen = platforms.filter((p) => SOCIAL_PLATFORM_VALUES.includes(p as never));
    if (!chosen.length) throw new ConvexError("Pick at least one platform.");

    const postIds: Id<"socialPosts">[] = [];
    for (const platform of chosen) {
      const content = await writeCopy(ctx, viewer._id, platform, book, instructions);
      const postId = await ctx.runMutation(internal.social.insertPost, {
        bookId,
        platform: platform as never,
        content,
        mediaStorageId: book.coverStorageId ?? undefined,
      });
      postIds.push(postId);
    }
    return { postIds };
  },
});

export const regenerateSocialPost = action({
  args: { postId: v.id("socialPosts"), instructions: v.optional(v.string()) },
  handler: async (ctx, { postId, instructions }): Promise<{ content: string }> => {
    const viewer = await ownerViewer(ctx);
    const post = await ctx.runQuery(internal.social.getPost, { postId });
    if (!post) throw new ConvexError("Post not found");
    const book = await ctx.runQuery(internal.social.bookForSocial, { bookId: post.bookId });
    if (!book) throw new ConvexError("Book not found");
    const content = await writeCopy(ctx, viewer._id, post.platform, book, instructions);
    await ctx.runMutation(internal.social.updatePostContent, { postId, content });
    return { content };
  },
});

// Publish through the self-hosted Postiz instance. Inert until POSTIZ_API_URL +
// POSTIZ_API_KEY are set — every other part of the flow works without them.
export const publishSocial = action({
  args: { postId: v.id("socialPosts") },
  handler: async (ctx, { postId }): Promise<{ status: string; postizPostId?: string }> => {
    await ownerViewer(ctx);
    const apiUrl = process.env.POSTIZ_API_URL;
    const apiKey = process.env.POSTIZ_API_KEY;
    if (!apiUrl || !apiKey) {
      throw new ConvexError("Publishing isn't wired yet. Set POSTIZ_API_URL and POSTIZ_API_KEY on the deployment, then connect accounts in Postiz.");
    }

    const post = await ctx.runQuery(internal.social.getPost, { postId });
    if (!post) throw new ConvexError("Post not found");
    if (post.status === "published") throw new ConvexError("Already published.");

    const account = await ctx.runQuery(api.social.listAccounts, {});
    const channel = account.find((a) => a.platform === post.platform && a.status === "connected");
    if (!channel) throw new ConvexError(`No connected ${post.platform} account. Connect it in Postiz first.`);

    try {
      const res = await fetch(`${apiUrl.replace(/\/$/, "")}/posts`, {
        method: "POST",
        headers: { Authorization: apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "now",
          posts: [{ integration: { id: channel.postizChannelId }, value: [{ content: post.content }] }],
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        throw new ConvexError(`Postiz publish failed: ${text.slice(0, 300)}`);
      }
      const json = (await res.json().catch(() => ({}))) as { id?: string; postId?: string };
      const postizPostId = json.id ?? json.postId;
      await ctx.runMutation(internal.social.markPost, { postId, status: "published", postizPostId });
      return { status: "published", postizPostId };
    } catch (err) {
      await ctx.runMutation(internal.social.markPost, { postId, status: "failed" });
      throw err instanceof ConvexError ? err : new ConvexError(`Postiz publish failed: ${String(err).slice(0, 300)}`);
    }
  },
});
