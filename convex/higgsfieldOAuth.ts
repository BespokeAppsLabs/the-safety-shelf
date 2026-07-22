"use node";
import { createHash, randomBytes } from "node:crypto";
import { ConvexError, v } from "convex/values";
import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { encryptSecret } from "./lib/secrets";
import { HIGGSFIELD_ISSUER, HIGGSFIELD_MCP_URL } from "./lib/higgsfield";

const issuer = HIGGSFIELD_ISSUER;
const scope = "openid email offline_access";

function b64url(buf: Buffer) {
  return buf.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function registerClient(redirectUri: string): Promise<string> {
  const res = await fetch(`${issuer}/oauth2/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_name: "The Safety Shelf",
      redirect_uris: [redirectUri],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      scope,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as { client_id?: string; error?: string; error_description?: string };
  if (!res.ok || !json.client_id) throw new ConvexError(`Higgsfield OAuth registration failed: ${json.error_description ?? json.error ?? res.statusText}`);
  return json.client_id;
}

export const start = action({
  args: { redirectUri: v.string() },
  handler: async (ctx, { redirectUri }): Promise<{ authorizationUrl: string }> => {
    if (!process.env.AI_CREDENTIALS_ENCRYPTION_KEY) throw new ConvexError("AI_CREDENTIALS_ENCRYPTION_KEY is not set on this deployment.");
    const viewer = await ctx.runQuery(api.users.getViewer, {});
    if (!viewer || viewer.role !== "owner") throw new ConvexError("Owner only");

    const clientId = await registerClient(redirectUri);
    const codeVerifier = b64url(randomBytes(32));
    const codeChallenge = b64url(createHash("sha256").update(codeVerifier).digest());
    const state = b64url(randomBytes(24));

    await ctx.runMutation(internal.oauthStates.create, {
      state,
      ownerId: viewer._id,
      provider: "higgsfield",
      codeVerifier,
      clientId,
      redirectUri,
      expiresAt: Date.now() + 10 * 60_000,
    });

    const url = new URL(`${issuer}/oauth2/authorize`);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", scope);
    url.searchParams.set("state", state);
    url.searchParams.set("code_challenge", codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
    return { authorizationUrl: url.toString() };
  },
});

export const complete = action({
  args: { code: v.string(), state: v.string() },
  handler: async (ctx, { code, state }): Promise<{ ok: true }> => {
    const oauthState = await ctx.runMutation(internal.oauthStates.consume, { state });
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: oauthState.clientId,
      redirect_uri: oauthState.redirectUri,
      code_verifier: oauthState.codeVerifier,
    });
    const res = await fetch(`${issuer}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const json = (await res.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string; error_description?: string };
    if (!res.ok || !json.access_token) throw new ConvexError(`Higgsfield token exchange failed: ${json.error_description ?? json.error ?? res.statusText}`);

    await ctx.runMutation(internal.aiCredentials.mutations.upsert.upsert, {
      ownerId: oauthState.ownerId,
      purpose: "image",
      provider: "higgsfield",
      kind: "mcp",
      encryptedKey: encryptSecret(json.access_token),
      keyLast4: "mcp",
      baseURL: HIGGSFIELD_MCP_URL,
      model: "higgsfield-auto",
      // Access tokens are short-lived; without the refresh token + client_id the
      // connection dies at expiry and can only be fixed by reconnecting by hand.
      encryptedRefreshToken: json.refresh_token ? encryptSecret(json.refresh_token) : undefined,
      accessTokenExpiresAt: json.expires_in ? Date.now() + json.expires_in * 1000 : undefined,
      clientId: oauthState.clientId,
    });
    return { ok: true };
  },
});
