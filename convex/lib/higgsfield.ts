import { ConvexError } from "convex/values";

// Higgsfield MCP client. Every shape here was read off a live `tools/list` +
// `models_explore` against mcp.higgsfield.ai — not inferred from the Higgsfield
// CLI. The CLI (`hf generate create flux_2`) and this MCP server are different
// products with different vocabularies: the CLI has a `flux_2` subcommand, the
// server has one `generate_image` tool taking a catalog model id in params.
export const HIGGSFIELD_ISSUER = "https://mcp.higgsfield.ai";
export const HIGGSFIELD_MCP_URL = "https://mcp.higgsfield.ai/mcp";

type McpTool = { name: string; description?: string; inputSchema?: unknown };

function parseMcpResponse(text: string) {
  // The endpoint answers either plain JSON or an SSE stream of `data:` frames.
  const payloads = text
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .filter((line) => line && line !== "[DONE]");
  for (const payload of payloads.length ? payloads : [text.trim()]) {
    if (!payload) continue;
    const parsed = JSON.parse(payload);
    if (parsed.error) throw new ConvexError(parsed.error.message ?? "Higgsfield MCP JSON-RPC error");
    if (parsed.result) return parsed.result;
  }
  return {} as Record<string, unknown>;
}

async function mcpPost(token: string, body: unknown, sessionId?: string) {
  const res = await fetch(HIGGSFIELD_MCP_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...(sessionId ? { "Mcp-Session-Id": sessionId } : {}),
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (res.status === 401 || res.status === 403) {
    throw new ConvexError("Higgsfield rejected the token (401/403). Reconnect Higgsfield in Settings.");
  }
  if (!res.ok) throw new ConvexError(`Higgsfield MCP HTTP ${res.status}: ${text.slice(0, 300)}`);
  return { result: parseMcpResponse(text), sessionId: res.headers.get("mcp-session-id") ?? sessionId };
}

/** An initialized MCP session. One handshake, then N tool calls. */
export class HiggsfieldSession {
  private constructor(private token: string, private sessionId?: string) {}

  static async open(token: string): Promise<HiggsfieldSession> {
    const init = await mcpPost(token, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "the-safety-shelf", version: "0.1.0" },
      },
    });
    await mcpPost(token, { jsonrpc: "2.0", method: "notifications/initialized", params: {} }, init.sessionId ?? undefined);
    return new HiggsfieldSession(token, init.sessionId ?? undefined);
  }

  private nextId = 2;

  async call(name: string, args: Record<string, unknown>): Promise<any> {
    const res = await mcpPost(
      this.token,
      { jsonrpc: "2.0", id: this.nextId++, method: "tools/call", params: { name, arguments: args } },
      this.sessionId,
    );
    this.sessionId = res.sessionId;
    const result = res.result as any;
    if (result?.isError) {
      const text = (result.content ?? []).map((c: any) => c?.text).filter(Boolean).join(" ");
      throw new ConvexError(`Higgsfield ${name} failed: ${text.slice(0, 300) || "unknown error"}`);
    }
    return result;
  }

  async listTools(): Promise<McpTool[]> {
    const res = await mcpPost(this.token, { jsonrpc: "2.0", id: this.nextId++, method: "tools/list", params: {} }, this.sessionId);
    this.sessionId = res.sessionId;
    return ((res.result as any)?.tools ?? []) as McpTool[];
  }
}

const TERMINAL_FAILURE = ["failed", "canceled", "cancelled", "error", "rejected", "nsfw"];
const SUCCESS = ["completed", "succeeded"];

/** Preflight credit cost without submitting a job. */
export async function higgsfieldCost(session: HiggsfieldSession, params: Record<string, unknown>): Promise<number | null> {
  const res = await session.call("generate_image", { params: { ...params, get_cost: true } });
  const credits = res?.structuredContent?.cost?.credits;
  return typeof credits === "number" ? credits : null;
}

/**
 * Submit one image job and poll to a terminal state. Returns the raw result URL.
 * `job_status` with sync:true blocks server-side up to ~25s, so this loop is
 * cheap: an image typically finishes in 10-20s, i.e. the first poll.
 */
export async function higgsfieldGenerate(
  session: HiggsfieldSession,
  params: Record<string, unknown>,
  deadlineMs = 5 * 60_000,
): Promise<string> {
  const submitted = await session.call("generate_image", { params });
  const first = submitted?.structuredContent?.results?.[0];
  const jobId: string | undefined = first?.id;
  if (!jobId) {
    throw new ConvexError(`Higgsfield accepted no job. Response: ${JSON.stringify(submitted?.structuredContent ?? {}).slice(0, 300)}`);
  }

  const deadline = Date.now() + deadlineMs;
  let status: string = first?.status ?? "pending";
  let url: string | undefined = first?.results?.rawUrl;

  while (!url) {
    if (SUCCESS.includes(status)) break;
    if (TERMINAL_FAILURE.includes(status)) {
      throw new ConvexError(`Higgsfield generation ${status}. Job ${jobId}.`);
    }
    if (Date.now() > deadline) {
      throw new ConvexError(`Higgsfield generation timed out after 5 min (last status "${status}", job ${jobId}).`);
    }
    const polled = await session.call("job_status", { jobId, sync: true });
    const generation = polled?.structuredContent?.generation;
    status = generation?.status ?? status;
    url = generation?.results?.rawUrl;
    if (!url && !SUCCESS.includes(status) && !TERMINAL_FAILURE.includes(status)) {
      const waitSeconds = Number(generation?.poll_after_seconds) || 3;
      await new Promise((resolve) => setTimeout(resolve, Math.min(waitSeconds, 15) * 1000));
    }
  }

  if (!url) throw new ConvexError(`Higgsfield reported "${status}" but returned no image URL (job ${jobId}).`);
  return url;
}

/** Download a generated result. MIME is checked — this is untrusted remote input. */
export async function downloadHiggsfieldImage(url: string): Promise<Blob> {
  if (!url.startsWith("https://")) throw new ConvexError("Higgsfield returned a non-HTTPS result URL.");
  const res = await fetch(url);
  if (!res.ok) throw new ConvexError(`Higgsfield result download failed: HTTP ${res.status}`);
  const blob = await res.blob();
  if (!blob.type.startsWith("image/")) {
    throw new ConvexError(`Higgsfield result was not an image (${blob.type || "unknown MIME"}).`);
  }
  return blob;
}
