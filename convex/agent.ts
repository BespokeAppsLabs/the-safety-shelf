"use node";
import { createDecipheriv, scryptSync } from "node:crypto";
import { z } from "zod";
import { ConvexError, v } from "convex/values";
import { generateText, stepCountIs, tool } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { action, type ActionCtx } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { PROVIDER_DEFAULTS } from "./aiCredentials/providers";
import { DEFAULT_SYSTEM_PROMPT } from "../lib/agentPrompt";
import { imageModel, imageModelsFor, formatImageEstimate } from "../lib/imageModels";

// Same master key / scheme as aiCredentials/actions/setKey.ts's encryptSecret
// — inlined again rather than shared, for the same reason: Convex's bundler
// wants Node-API usage and the "use node" directive co-located in one file.
function decryptSecret(payload: string): string {
  const key = scryptSync(process.env.AI_CREDENTIALS_ENCRYPTION_KEY ?? "", "midnight-library-ai-credentials", 32);
  const [ivB64, tagB64, dataB64] = payload.split(".");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
}

// The only pages the navigate tool may send the owner to. Kept here (server
// side, enforced) rather than only in the prompt, so a hallucinated path is
// caught and bounced back to the model instead of rendering a dead link.
// /book/<slug> and /read/<slug> are validated separately against live slugs.
const STATIC_ROUTES: Record<string, string> = {
  "/": "marketing home",
  "/store": "public storefront",
  "/library": "customer's owned books",
  "/admin": "dashboard overview",
  "/admin/books": "catalog",
  "/admin/agent": "this agent workspace",
  "/admin/settings": "AI provider settings",
};

// Returns null when the path is valid, or a correction message (fed straight
// back to the model as the tool result) when it isn't.
export function validateRoute(href: string, liveSlugs: string[]): string | null {
  const path = href.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  if (path in STATIC_ROUTES) return null;

  const dynamic = path.match(/^\/(book|read)\/([^/]+)$/);
  if (dynamic) {
    const slug = dynamic[2];
    if (liveSlugs.includes(slug)) return null;
    return `No live book with slug "${slug}". Available slugs: ${liveSlugs.join(", ") || "(none)"}. Do not navigate there.`;
  }

  return `"${href}" is not a real page. Valid paths: ${Object.keys(STATIC_ROUTES).join(", ")}, or /book/<slug> and /read/<slug>. Pick one of these or tell the owner the page doesn't exist.`;
}

// Context layer: the versioned system prompt (convex/agentPrompts.ts, falls
// back to lib/agentPrompt.ts's default until the owner publishes a version)
// plus a live catalog snapshot and an authoritative navigation map, so the
// agent starts every session knowing what it's operating on and exactly which
// paths navigate will accept.
async function buildSystemPrompt(ctx: ActionCtx): Promise<string> {
  const [activePrompt, categories, liveBooks] = await Promise.all([
    ctx.runQuery(api.agentPrompts.getActive, {}),
    ctx.runQuery(api.categories.list, {}),
    ctx.runQuery(api.books.listLive, {}),
  ]);

  const basePrompt = activePrompt?.content ?? DEFAULT_SYSTEM_PROMPT;
  const snapshot = `Current catalog snapshot: ${liveBooks.length} live book${liveBooks.length === 1 ? "" : "s"} across ${categories.length} categor${categories.length === 1 ? "y" : "ies"}.`;

  const routeLines = Object.entries(STATIC_ROUTES).map(([path, desc]) => `- ${path} — ${desc}`);
  const bookLine = liveBooks.length
    ? `- /book/<slug> and /read/<slug> — a book's storefront / reader page. Live slugs: ${liveBooks.map((book) => book.slug).join(", ")}.`
    : "- No live books yet, so no /book or /read paths are valid.";
  const navMap = `Navigation map — the navigate tool ONLY accepts these exact paths. Any other path is rejected and you'll be told to correct it; never invent a path:\n${routeLines.join("\n")}\n${bookLine}`;

  return `${basePrompt}\n\n${snapshot}\n\n${navMap}`;
}

// docs/03-admin-agent.md's tool -> component contract: every tool returns
// { data, component, props }. `data` is what the model reasons over on the
// next step; `component` + `props` is what the client looks up in
// lib/agentComponents.tsx's registry to render an inline card. Cards are
// extracted from result.toolResults after generateText, below.

async function imageProviderStatus(ctx: ActionCtx) {
  const viewer = await ctx.runQuery(api.users.getViewer, {});
  if (!viewer || viewer.role !== "owner") throw new ConvexError("Owner only");
  const credential = await ctx.runQuery(internal.aiCredentials.queries.getForOwner.getForOwner, {
    ownerId: viewer._id,
    purpose: "image",
  });
  return credential?.isActive ? credential.provider : null;
}


function pickImageModel(provider: string, requested?: string) {
  const models = imageModelsFor(provider);
  const model = requested ? imageModel(requested) : models[0];
  if (!model || model.provider !== provider) {
    throw new ConvexError(`Selected image model is not available for ${provider}. Available: ${models.map((m) => m.id).join(", ") || "none"}.`);
  }
  return model;
}

async function coverUrl(ctx: ActionCtx, book: { coverStorageId?: string | null }) {
  return book.coverStorageId ? ctx.storage.getUrl(book.coverStorageId as never) : null;
}

// Read-only stats tools — safe to execute directly, no propose-then-confirm
// needed (nothing is written, spent, or published). Draft/write tools from
// docs/03-admin-agent.md (writeBook, publishBook, ...) still need an inline
// approval UI in the chat and aren't wired here yet.
function buildTools(ctx: ActionCtx) {
  return {
    getTopSellers: tool({
      description: "List the best-selling books by units sold, with revenue.",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(20).optional().describe("How many books to return, default 5"),
      }),
      execute: async ({ limit = 5 }) => {
        const [books, summary] = await Promise.all([
          ctx.runQuery(api.books.listAll, {}),
          ctx.runQuery(api.books.salesSummary, {}),
        ]);
        const rows = await Promise.all(
          books
            .map((book) => ({
              title: book.title,
              slug: book.slug,
              status: book.status,
              units: summary[book._id]?.units ?? 0,
              revenueCents: summary[book._id]?.revenueCents ?? 0,
              gradientFrom: book.gradientFrom,
              gradientTo: book.gradientTo,
              coverStorageId: book.coverStorageId,
            }))
            .sort((a, b) => b.units - a.units)
            .slice(0, limit)
            .map(async (row) => ({ ...row, coverUrl: await coverUrl(ctx, row) })),
        );
        return { data: rows, component: "TopSellersTable", props: { rows } };
      },
    }),
    getRevenue: tool({
      description: "Total units sold and revenue across the whole catalog. No time-window filtering yet — this is all-time.",
      inputSchema: z.object({}),
      execute: async () => {
        const summary = await ctx.runQuery(api.books.salesSummary, {});
        const values = Object.values(summary);
        const data = {
          totalUnits: values.reduce((sum, v) => sum + v.units, 0),
          totalRevenueCents: values.reduce((sum, v) => sum + v.revenueCents, 0),
        };
        return { data, component: "RevenueStatsCard", props: data };
      },
    }),
    getBookStats: tool({
      description: "Look up units sold, revenue, and status for one book by title (partial match is fine).",
      inputSchema: z.object({ title: z.string().describe("Full or partial book title") }),
      execute: async ({ title }) => {
        const [books, summary] = await Promise.all([
          ctx.runQuery(api.books.listAll, {}),
          ctx.runQuery(api.books.salesSummary, {}),
        ]);
        const needle = title.trim().toLowerCase();
        const match = books.find((book) => book.title.toLowerCase().includes(needle));
        if (!match) return { data: { found: false as const }, component: undefined, props: undefined };
        const props = {
          found: true as const,
          title: match.title,
          slug: match.slug,
          status: match.status,
          priceCents: match.priceCents,
          units: summary[match._id]?.units ?? 0,
          revenueCents: summary[match._id]?.revenueCents ?? 0,
          gradientFrom: match.gradientFrom,
          gradientTo: match.gradientTo,
          coverUrl: await coverUrl(ctx, match),
        };
        return { data: props, component: "BookStatsCard", props };
      },
    }),
    navigate: tool({
      description:
        "Send the owner to a page in the app. `href` MUST be one of the exact paths in the navigation map in your system prompt — invalid paths are rejected. Use this whenever the owner asks to go/open/see a page.",
      inputSchema: z.object({
        href: z.string().describe("App path from the navigation map, e.g. /admin/books"),
        label: z.string().describe("Short label for the link, e.g. 'Open catalog'"),
      }),
      execute: async ({ href, label }) => {
        const liveBooks = await ctx.runQuery(api.books.listLive, {});
        const error = validateRoute(href, liveBooks.map((book) => book.slug));
        // No component ⇒ no card rendered; the error text becomes the tool
        // result the model reads on its next step, so it can retry or explain.
        if (error) return { data: { error }, error };
        return { data: { href, label }, component: "NavigateCard", props: { href, label } };
      },
    }),
    // Write tools: they NEVER mutate directly. They record a proposal in
    // agentActions and return a card with Approve/Reject; the write only runs
    // when the owner clicks Approve (agentActions.approveAndExecute). See
    // docs/03-admin-agent.md's propose-then-confirm rule.
    writeBook: tool({
      description:
        "Propose saving a NEW draft book that you have fully written. Provide the complete content. This does NOT save anything — it creates a proposal the owner must Approve. Never tell the owner the book exists until the tool result says it executed.",
      inputSchema: z.object({
        title: z.string().describe("Book title"),
        author: z.string().optional(),
        blurb: z.string().describe("One-paragraph storefront blurb"),
        categorySlug: z.string().describe("Must be one of the catalog category slugs"),
        priceCents: z.number().int().min(1).describe("Price in cents, e.g. 999 for $9.99"),
        ageGroup: z.string().optional().describe("e.g. 'All ages', 'Parents'"),
        chapters: z
          .array(z.object({ heading: z.string(), paragraphs: z.array(z.string()).min(1) }))
          .min(1)
          .describe("The book's chapters, each a heading plus its paragraphs"),
      }),
      execute: async ({ categorySlug, ...draft }) => {
        const categories = await ctx.runQuery(api.categories.list, {});
        const category = categories.find((c) => c.slug === categorySlug);
        if (!category) {
          const error = `Unknown category "${categorySlug}". Valid slugs: ${categories.map((c) => c.slug).join(", ")}.`;
          return { data: { error }, error };
        }
        const actionId = await ctx.runMutation(api.agentActions.propose, {
          tool: "writeBook",
          args: { ...draft, categoryId: category._id },
        });
        return {
          data: { proposed: true, title: draft.title },
          component: "BookDraftCard",
          props: {
            actionId,
            title: draft.title,
            blurb: draft.blurb,
            chapterCount: draft.chapters.length,
            priceCents: draft.priceCents,
            category: category.title,
          },
        };
      },
    }),
    publishBook: tool({
      description:
        "Propose flipping an existing DRAFT book to live so customers can buy it, matched by title. This does NOT publish — it creates a proposal the owner must Approve. Never claim it was published until the tool result says it executed.",
      inputSchema: z.object({ title: z.string().describe("Full or partial title of the draft book") }),
      execute: async ({ title }) => {
        const books = await ctx.runQuery(api.books.listAll, {});
        const needle = title.trim().toLowerCase();
        const match = books.find((book) => book.title.toLowerCase().includes(needle));
        if (!match) {
          const error = `No book matches "${title}".`;
          return { data: { error }, error };
        }
        if (match.status === "live") {
          const error = `"${match.title}" is already live.`;
          return { data: { error }, error };
        }
        const actionId = await ctx.runMutation(api.agentActions.propose, {
          tool: "publishBook",
          args: { bookId: match._id, title: match.title },
          relatedBookId: match._id,
        });
        return {
          data: { proposed: true, title: match.title },
          component: "ProposalCard",
          props: {
            actionId,
            title: `Publish "${match.title}"`,
            summary: `Make "${match.title}" live and purchasable in the store.`,
          },
        };
      },
    }),
    generateCoverImage: tool({
      description:
        "Propose spending image-provider credits to generate or regenerate a square cover image for an existing book. This does NOT generate until the owner approves the card.",
      inputSchema: z.object({
        title: z.string().describe("Full or partial book title"),
        modelId: z.string().optional().describe("Optional image model id from the connected image provider"),
        prompt: z.string().optional().describe("Optional final image prompt; blank uses the book title and blurb"),
      }),
      execute: async ({ title, modelId, prompt }) => {
        const provider = await imageProviderStatus(ctx);
        if (!provider) return { data: { error: "No image provider connected." }, error: "No image provider connected — open Settings and connect one first." };
        const books = await ctx.runQuery(api.books.listAll, {});
        const needle = title.trim().toLowerCase();
        const match = books.find((book) => book.title.toLowerCase().includes(needle));
        if (!match) return { data: { error: `No book matches "${title}".` }, error: `No book matches "${title}".` };
        const model = pickImageModel(provider, modelId);
        const finalPrompt = prompt?.trim() || `Square professional digital book cover for The Safety Shelf. Title: ${match.title}. Topic: ${match.blurb}. Safety-first editorial illustration, clean shelf/shield motif, no small body text.`;
        const actionId = await ctx.runMutation(api.agentActions.propose, {
          tool: "generateCoverImage",
          args: { bookId: match._id, title: match.title, modelId: model.id, prompt: finalPrompt },
          relatedBookId: match._id,
        });
        return {
          data: { proposed: true, title: match.title, modelId: model.id, estimate: formatImageEstimate(model.estimateCents, model.estimateCredits) },
          component: "ImageGenerationProposalCard",
          props: { actionId, target: "cover", bookId: match._id, title: match.title, modelId: model.id, prompt: finalPrompt, estimate: formatImageEstimate(model.estimateCents, model.estimateCredits) },
        };
      },
    }),
    generatePageImage: tool({
      description:
        "Propose spending image-provider credits to generate or regenerate one chapter/page image for an existing book. This does NOT generate until the owner approves the card.",
      inputSchema: z.object({
        title: z.string().describe("Full or partial book title"),
        chapter: z.number().int().min(1).describe("Chapter/page number to illustrate"),
        modelId: z.string().optional().describe("Optional image model id from the connected image provider"),
        prompt: z.string().optional().describe("Optional final image prompt; blank uses the page/chapter text"),
      }),
      execute: async ({ title, chapter, modelId, prompt }) => {
        const provider = await imageProviderStatus(ctx);
        if (!provider) return { data: { error: "No image provider connected." }, error: "No image provider connected — open Settings and connect one first." };
        const books = await ctx.runQuery(api.books.listAll, {});
        const needle = title.trim().toLowerCase();
        const match = books.find((book) => book.title.toLowerCase().includes(needle));
        if (!match) return { data: { error: `No book matches "${title}".` }, error: `No book matches "${title}".` };
        const blocks = await ctx.runQuery(api.bookBlocks.listByBook, { bookId: match._id });
        if (!blocks.some((block) => block.chapter === chapter)) return { data: { error: `"${match.title}" has no chapter/page ${chapter}.` }, error: `"${match.title}" has no chapter/page ${chapter}.` };
        const model = pickImageModel(provider, modelId);
        const chapterText = blocks.filter((b) => b.chapter === chapter && b.type !== "img").map((b) => b.text).filter(Boolean).join("\n");
        const finalPrompt = prompt?.trim() || `Square safety guide illustration for "${match.title}", chapter ${chapter}. Reflect this content: ${chapterText.slice(0, 900)}. Warm, clear, educational, diverse people, no text overlays.`;
        const actionId = await ctx.runMutation(api.agentActions.propose, {
          tool: "generatePageImage",
          args: { bookId: match._id, title: match.title, chapter, modelId: model.id, prompt: finalPrompt },
          relatedBookId: match._id,
        });
        return {
          data: { proposed: true, title: match.title, chapter, modelId: model.id, estimate: formatImageEstimate(model.estimateCents, model.estimateCredits) },
          component: "ImageGenerationProposalCard",
          props: { actionId, target: "page", bookId: match._id, chapter, title: `${match.title} · page ${chapter}`, modelId: model.id, prompt: finalPrompt, estimate: formatImageEstimate(model.estimateCents, model.estimateCredits) },
        };
      },
    }),
  };
}

// Plain chat + read-only stats tools, talking to whatever provider is
// connected in Settings (BYOK cloud key or local Ollama). Write/publish/social
// tools from docs/03-admin-agent.md still need an inline propose-then-confirm
// UI in chat — not built yet, and the system prompt tells the model not to
// claim it executed one.
export const sendMessage = action({
  args: { message: v.string(), chatId: v.optional(v.id("agentChats")), runId: v.optional(v.string()) },
  handler: async (
    ctx,
    { message, chatId, runId },
  ): Promise<{ reply: string; cards: { component: string; props: unknown }[] }> => {
    const viewer = await ctx.runQuery(api.users.getViewer, {});
    if (!viewer || viewer.role !== "owner") throw new ConvexError("Owner only");

    const credential = await ctx.runQuery(internal.aiCredentials.queries.getForOwner.getForOwner, {
      ownerId: viewer._id,
      purpose: "text",
    });
    if (!credential) throw new ConvexError("No AI provider connected — set one up in Settings first.");

    const apiKey = credential.provider === "ollama" ? "ollama-local" : decryptSecret(credential.encryptedKey!);
    const modelId = credential.model ?? PROVIDER_DEFAULTS[credential.provider].model;
    const client = createOpenAI({ apiKey, baseURL: credential.baseURL });

    // History is server-authoritative — loaded from the persisted session, not
    // trusted from the client — so the thread the model sees always matches
    // what's stored. Cards are stripped: the model only reasons over text.
    const stored = chatId
      ? await ctx.runQuery(internal.agentChats.getForOwner, { ownerId: viewer._id, chatId })
      : null;
    const priorMessages = (stored ?? []).map(({ role, content }) => ({ role, content }));

    const system = await buildSystemPrompt(ctx);
    const messages = [...priorMessages, { role: "user" as const, content: message }];
    const start = Date.now();

    // Server-side interrupt: a client-minted runId lets the owner's Esc cancel
    // this run. begin() also catches a stop that raced ahead of us. While
    // generating, poll the flag and abort generateText — which aborts the
    // upstream provider request, so generation actually halts (tokens saved),
    // not just the client's wait.
    const controller = new AbortController();
    let cancelPoll: ReturnType<typeof setInterval> | undefined;
    if (runId) {
      const { cancelled } = await ctx.runMutation(internal.agentRuns.begin, { runId, ownerId: viewer._id });
      if (cancelled) {
        await ctx.runMutation(internal.agentRuns.finish, { runId });
        throw new ConvexError("Stopped by owner");
      }
      cancelPoll = setInterval(() => {
        void ctx
          .runQuery(internal.agentRuns.status, { runId })
          .then((s) => { if (s.cancelled) controller.abort(); })
          .catch(() => {});
      }, 500);
    }

    try {
      // .chat(), not calling client(modelId) directly — the latter defaults
      // to OpenAI's newer Responses API, whose "item_reference" input items
      // aren't understood by third-party OpenAI-compatible endpoints
      // (Ollama, DeepSeek, ...). .chat() forces the classic Chat Completions
      // API shape that they all actually implement.
      const result = await generateText({
        model: client.chat(modelId),
        system,
        messages,
        tools: buildTools(ctx),
        stopWhen: stepCountIs(4),
        abortSignal: controller.signal,
      });
      const toolNames = result.toolCalls.map((call) => call.toolName);
      await ctx.runMutation(internal.agentLogs.record, {
        role: "orchestrator",
        model: modelId,
        tool: toolNames.length ? toolNames.join(",") : undefined,
        inputTokens: result.usage.inputTokens ?? 0,
        outputTokens: result.usage.outputTokens ?? 0,
        latencyMs: Date.now() - start,
        status: "ok",
      });
      // Project to exactly { component, props }: the tool output also carries
      // `data` (model-only reasoning) and sometimes `error`, neither of which
      // belongs in the persisted/returned card — and `data` is an extra field
      // the agentChats validator rejects.
      const cards = result.toolResults
        .map((toolResult) => toolResult.output as { component?: string; props?: unknown })
        .filter((output): output is { component: string; props: unknown } => Boolean(output?.component))
        .map(({ component, props }) => ({ component, props }));

      // No persistence here: the client commits the turn (agentChats.appendTurn)
      // once it has the reply, so pressing Esc before it lands means the turn is
      // never stored — a real stop. `chatId` is still used above to load history.
      return { reply: result.text, cards };
    } catch (error) {
      // Owner aborted mid-generation — expected, not an error. Log it as a
      // stopped run and surface a clean signal (the client already knows).
      const aborted = controller.signal.aborted;
      const errorMessage = aborted ? "Stopped by owner" : error instanceof Error ? error.message : String(error);
      await ctx.runMutation(internal.agentLogs.record, {
        role: "orchestrator",
        model: modelId,
        inputTokens: 0,
        outputTokens: 0,
        latencyMs: Date.now() - start,
        status: "error",
        errorMessage,
      });
      throw new ConvexError(aborted ? "Stopped by owner" : `Chat failed: ${errorMessage}`);
    } finally {
      if (cancelPoll) clearInterval(cancelPoll);
      if (runId) await ctx.runMutation(internal.agentRuns.finish, { runId });
    }
  },
});
