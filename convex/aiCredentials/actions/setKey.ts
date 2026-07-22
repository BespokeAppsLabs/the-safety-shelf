"use node";
import { createCipheriv, randomBytes, scryptSync } from "node:crypto";
import { ConvexError, v } from "convex/values";
import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { action } from "../../_generated/server";
import { internal, api } from "../../_generated/api";
import { PROVIDER_DEFAULTS, isImageProvider, isTextProvider } from "../providers";

const providerArg = v.union(v.literal("openai"), v.literal("deepseek"), v.literal("kimi"), v.literal("glm"), v.literal("ollama"), v.literal("stability"), v.literal("higgsfield"));

function encryptSecret(plaintext: string): string {
  const key = scryptSync(process.env.AI_CREDENTIALS_ENCRYPTION_KEY ?? "", "midnight-library-ai-credentials", 32);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((buf) => buf.toString("base64")).join(".");
}

async function detectOllamaModel(baseURL: string): Promise<string | undefined> {
  try {
    const res = await fetch(`${baseURL.replace(/\/v1\/?$/, "")}/api/tags`);
    if (!res.ok) return undefined;
    const data = (await res.json()) as { models?: Array<{ name: string }> };
    return data.models?.[0]?.name;
  } catch {
    return undefined;
  }
}

export const setKey = action({
  args: {
    purpose: v.optional(v.union(v.literal("text"), v.literal("image"))),
    provider: providerArg,
    apiKey: v.optional(v.string()),
    model: v.optional(v.string()),
  },
  handler: async (ctx, { purpose = "text", provider, apiKey, model: modelOverride }): Promise<{ ok: true; model: string }> => {
    if (!process.env.AI_CREDENTIALS_ENCRYPTION_KEY) throw new ConvexError("AI_CREDENTIALS_ENCRYPTION_KEY is not set on this deployment.");
    const viewer = await ctx.runQuery(api.users.getViewer, {});
    if (!viewer || viewer.role !== "owner") throw new ConvexError("Owner only");

    if (purpose === "text" && !isTextProvider(provider)) throw new ConvexError(`${provider} is not a text provider here.`);
    if (purpose === "image" && !isImageProvider(provider)) throw new ConvexError(`${provider} is not an image provider here.`);

    const isOllama = provider === "ollama";
    const isMcp = provider === "higgsfield";
    const key = isMcp ? undefined : isOllama ? (apiKey?.trim() || "ollama-local") : apiKey?.trim();
    if (!isMcp && !isOllama && (!key || key.length < 8)) throw new ConvexError("That doesn't look like a real API key");

    const { baseURL } = PROVIDER_DEFAULTS[provider];
    const model = modelOverride || (isOllama ? await detectOllamaModel(baseURL!) : undefined) || PROVIDER_DEFAULTS[provider].model;

    if (purpose === "text") {
      const client = createOpenAI({ apiKey: key, baseURL });
      try {
        await generateText({ model: client.chat(model), prompt: "Reply with just: OK", maxOutputTokens: 5 });
      } catch (error) {
        const hint = isOllama ? " Is `ollama serve` running on this machine?" : "";
        throw new ConvexError(`Could not validate ${provider} (${model}): ${error instanceof Error ? error.message : String(error)}.${hint}`);
      }
    }

    await ctx.runMutation(internal.aiCredentials.mutations.upsert.upsert, {
      ownerId: viewer._id,
      purpose,
      provider,
      kind: isMcp ? "mcp" : "apiKey",
      encryptedKey: key ? encryptSecret(key) : undefined,
      keyLast4: isMcp ? "mcp" : isOllama ? "n/a" : key!.slice(-4),
      baseURL,
      model,
    });

    return { ok: true, model };
  },
});
