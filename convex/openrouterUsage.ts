"use node";

import { ConvexError } from "convex/values";
import { action, type ActionCtx } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { decryptSecret } from "./lib/secrets";
import { OPENROUTER_BASE_URL } from "./aiCredentials/providers";

type KeyData = {
  // OpenRouter's own masked label for the key, e.g. "sk-or-v1-459...bc1".
  label?: string;
  is_free_tier?: boolean;
  usage?: number;
  usage_daily?: number;
  usage_weekly?: number;
  usage_monthly?: number;
  limit?: number | null;
  limit_remaining?: number | null;
  limit_reset?: "daily" | "weekly" | "monthly" | null;
};

async function requireOwnerCredential(ctx: ActionCtx) {
  const viewer = await ctx.runQuery(api.users.getViewer, {});
  if (!viewer || viewer.role !== "owner") throw new ConvexError("Owner only");
  const credential = await ctx.runQuery(internal.aiCredentials.queries.getForOwner.getForOwner, { ownerId: viewer._id });
  if (!credential?.encryptedKey) throw new ConvexError("No OpenRouter key connected — set it up in Settings first.");
  return decryptSecret(credential.encryptedKey);
}

// OpenRouter's `/key` endpoint provides usage and a key-level budget. Account
// credits require a management key, so report that limitation rather than
// inventing an account balance for ordinary API keys.
export const get = action({
  args: {},
  handler: async (ctx) => {
    const key = await requireOwnerCredential(ctx);
    const response = await fetch(`${OPENROUTER_BASE_URL}/key`, { headers: { Authorization: `Bearer ${key}` } });
    if (!response.ok) throw new ConvexError(`OpenRouter usage check failed (HTTP ${response.status}).`);
    const payload = await response.json() as { data?: KeyData };
    if (!payload.data) throw new ConvexError("OpenRouter returned an invalid usage response.");
    const data = payload.data;
    return {
      // Surfaced so the dashboard can say WHICH key it is reporting on. Without
      // it, a limit set on a different key looks like the app under-reporting.
      label: data.label ?? null,
      isFreeTier: data.is_free_tier ?? false,
      usage: data.usage ?? 0,
      usageDaily: data.usage_daily ?? 0,
      usageWeekly: data.usage_weekly ?? 0,
      usageMonthly: data.usage_monthly ?? 0,
      limit: data.limit ?? null,
      limitRemaining: data.limit_remaining ?? null,
      limitReset: data.limit_reset ?? null,
    };
  },
});
