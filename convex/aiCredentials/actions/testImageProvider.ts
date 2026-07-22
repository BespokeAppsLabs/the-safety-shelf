"use node";
import { createDecipheriv, scryptSync } from "node:crypto";
import { ConvexError } from "convex/values";
import { action } from "../../_generated/server";
import { api, internal } from "../../_generated/api";

function decryptSecret(payload: string): string {
  const key = scryptSync(process.env.AI_CREDENTIALS_ENCRYPTION_KEY ?? "", "midnight-library-ai-credentials", 32);
  const [ivB64, tagB64, dataB64] = payload.split(".");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
}

export const testImageProvider = action({
  args: {},
  handler: async (ctx): Promise<{ ok: boolean; provider?: string; message: string; status?: number }> => {
    const viewer = await ctx.runQuery(api.users.getViewer, {});
    if (!viewer || viewer.role !== "owner") throw new ConvexError("Owner only");
    const credential = await ctx.runQuery(internal.aiCredentials.queries.getForOwner.getForOwner, {
      ownerId: viewer._id,
      purpose: "image",
    });
    if (!credential) return { ok: false, message: "No image provider connected." };

    if (credential.provider !== "higgsfield") {
      return { ok: true, provider: credential.provider, message: `${credential.provider} image key is saved. Generation call will validate it.` };
    }
    if (!credential.encryptedKey) return { ok: false, provider: "higgsfield", message: "Higgsfield token missing — login again." };

    const token = decryptSecret(credential.encryptedKey);
    const res = await fetch(credential.baseURL ?? "https://mcp.higgsfield.ai/mcp", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "the-safety-shelf", version: "0.1.0" } } }),
    }).catch((error) => ({ ok: false, status: 0, text: async () => String(error) } as Response));

    const text = await res.text().catch(() => "");
    if (res.ok) return { ok: true, provider: "higgsfield", status: res.status, message: "Higgsfield MCP token works from the app runtime." };
    if (res.status === 401 || res.status === 403) {
      return { ok: false, provider: "higgsfield", status: res.status, message: "Saved Higgsfield token was rejected — login again." };
    }
    return { ok: false, provider: "higgsfield", status: res.status, message: `Higgsfield MCP test failed: ${text.slice(0, 240) || res.statusText}` };
  },
});
