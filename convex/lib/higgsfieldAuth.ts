"use node";
import { ConvexError } from "convex/values";
import type { ActionCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { decryptSecret, encryptSecret } from "./secrets";
import { HIGGSFIELD_ISSUER } from "./higgsfield";

const EXPIRY_SKEW_MS = 60_000;

/**
 * Returns a usable Higgsfield access token, refreshing it first if it has (or
 * is about to) expire. Higgsfield issues short-lived access tokens; without
 * this the connection silently dies and every generation 401s until the owner
 * reconnects by hand.
 */
export async function higgsfieldAccessToken(ctx: ActionCtx, credential: Doc<"aiCredentials">): Promise<string> {
  if (!credential.encryptedKey) throw new ConvexError("Higgsfield credential is missing. Reconnect in Settings.");

  const expiresAt = credential.accessTokenExpiresAt;
  const stillValid = expiresAt === undefined || expiresAt - EXPIRY_SKEW_MS > Date.now();
  if (stillValid) return decryptSecret(credential.encryptedKey);

  if (!credential.encryptedRefreshToken || !credential.clientId) {
    throw new ConvexError("Higgsfield session expired and cannot be refreshed. Reconnect Higgsfield in Settings.");
  }

  const res = await fetch(`${HIGGSFIELD_ISSUER}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: decryptSecret(credential.encryptedRefreshToken),
      client_id: credential.clientId,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    access_token?: string; refresh_token?: string; expires_in?: number; error?: string; error_description?: string;
  };
  if (!res.ok || !json.access_token) {
    throw new ConvexError(`Higgsfield token refresh failed: ${json.error_description ?? json.error ?? res.statusText}. Reconnect in Settings.`);
  }

  await ctx.runMutation(internal.aiCredentials.mutations.updateTokens.updateTokens, {
    credentialId: credential._id,
    encryptedKey: encryptSecret(json.access_token),
    // Higgsfield may rotate the refresh token; keep the old one if it doesn't.
    encryptedRefreshToken: json.refresh_token ? encryptSecret(json.refresh_token) : undefined,
    accessTokenExpiresAt: json.expires_in ? Date.now() + json.expires_in * 1000 : undefined,
  });
  return json.access_token;
}