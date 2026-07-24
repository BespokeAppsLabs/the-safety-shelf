"use node";
import { ConvexError, v } from "convex/values";
import { action } from "../../_generated/server";
import { internal, api } from "../../_generated/api";
import { encryptSecret } from "../../lib/secrets";
import { OPENROUTER_TEXT_MODEL } from "../providers";
import { validateOpenRouterKey } from "../../lib/openrouter";

export const setKey = action({
  args: { apiKey: v.string() },
  handler: async (ctx, { apiKey }): Promise<{ ok: true; model: string }> => {
    if (!process.env.AI_CREDENTIALS_ENCRYPTION_KEY) throw new ConvexError("AI_CREDENTIALS_ENCRYPTION_KEY is not set on this deployment.");
    const viewer = await ctx.runQuery(api.users.getViewer, {});
    if (!viewer || viewer.role !== "owner") throw new ConvexError("Owner only");

    const key = apiKey.trim();
    if (key.length < 8) throw new ConvexError("That doesn't look like a real API key");
    try {
      await validateOpenRouterKey(key);
    } catch (error) {
      throw new ConvexError(`Could not validate OpenRouter: ${error instanceof Error ? error.message : String(error)}`);
    }

    await ctx.runMutation(internal.aiCredentials.mutations.upsert.upsert, {
      ownerId: viewer._id,
      encryptedKey: encryptSecret(key),
      keyLast4: key.slice(-4),
    });
    return { ok: true, model: OPENROUTER_TEXT_MODEL };
  },
});
