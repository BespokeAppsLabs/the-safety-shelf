import { afterEach, expect, test, vi } from "vitest";
import { HiggsfieldSession, higgsfieldGenerate, downloadHiggsfieldImage } from "../convex/lib/higgsfield";

// Response shapes below are copied from a live mcp.higgsfield.ai session — the
// bug this guards against was code written against the Higgsfield *CLI* vocabulary
// (a `generate create flux_2` subcommand) instead of the MCP server's real
// `generate_image` + `job_status` tools.

function mcpReply(result: unknown) {
  return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result }), {
    status: 200,
    headers: { "content-type": "application/json", "mcp-session-id": "sess-1" },
  });
}

const submitted = (id: string) => ({ content: [], structuredContent: { results: [{ id, type: "image", status: "pending", model: "flux_2" }] } });
const finished = (id: string, url: string) => ({
  content: [],
  structuredContent: { generation: { id, status: "completed", model: "flux_2", results: { rawUrl: url, minUrl: `${url}_min.webp` } } },
});

async function openSession(fetchMock: ReturnType<typeof vi.fn>) {
  vi.stubGlobal("fetch", fetchMock);
  // initialize + notifications/initialized
  fetchMock.mockResolvedValueOnce(mcpReply({ protocolVersion: "2025-06-18" }));
  fetchMock.mockResolvedValueOnce(mcpReply({}));
  return HiggsfieldSession.open("token");
}

afterEach(() => vi.unstubAllGlobals());

test("submits generate_image with params nested under `params` and polls job_status", async () => {
  const fetchMock = vi.fn();
  const session = await openSession(fetchMock);
  const url = "https://cdn.example.com/hf_result.png";
  fetchMock.mockResolvedValueOnce(mcpReply(submitted("job-1")));
  fetchMock.mockResolvedValueOnce(mcpReply(finished("job-1", url)));

  const result = await higgsfieldGenerate(session, { model: "flux_2", prompt: "cover", aspect_ratio: "1:1", variant: "pro" });
  expect(result).toBe(url);

  const submitBody = JSON.parse(fetchMock.mock.calls[2][1].body);
  expect(submitBody.params.name).toBe("generate_image");
  // The whole bug in one assertion: arguments nest under `params`, and the model
  // is a catalog id in there — not a tool name, and not a top-level `model` flag.
  expect(submitBody.params.arguments).toEqual({ params: { model: "flux_2", prompt: "cover", aspect_ratio: "1:1", variant: "pro" } });

  const pollBody = JSON.parse(fetchMock.mock.calls[3][1].body);
  expect(pollBody.params.name).toBe("job_status");
  expect(pollBody.params.arguments).toEqual({ jobId: "job-1", sync: true });
});

test("takes the URL from structuredContent, not by regex-scraping the payload", async () => {
  const fetchMock = vi.fn();
  const session = await openSession(fetchMock);
  fetchMock.mockResolvedValueOnce(mcpReply(submitted("job-2")));
  fetchMock.mockResolvedValueOnce(mcpReply({
    content: [{ type: "text", text: "Open https://higgsfield.ai/marketing-studio to view" }],
    structuredContent: { generation: { id: "job-2", status: "completed", results: { rawUrl: "https://cdn.example.com/real.png" } } },
  }));
  // The old findStringUrl() would have returned the marketing-studio link here.
  await expect(higgsfieldGenerate(session, { model: "flux_2", prompt: "x" })).resolves.toBe("https://cdn.example.com/real.png");
});

test("surfaces a failed job instead of hanging until the deadline", async () => {
  const fetchMock = vi.fn();
  const session = await openSession(fetchMock);
  fetchMock.mockResolvedValueOnce(mcpReply(submitted("job-3")));
  fetchMock.mockResolvedValueOnce(mcpReply({ structuredContent: { generation: { id: "job-3", status: "failed" } } }));
  await expect(higgsfieldGenerate(session, { model: "flux_2", prompt: "x" })).rejects.toThrow(/failed/i);
});

test("rejects a non-image result rather than storing it as a cover", async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockResolvedValueOnce(new Response("<html>login</html>", { status: 200, headers: { "content-type": "text/html" } }));
  await expect(downloadHiggsfieldImage("https://cdn.example.com/x.png")).rejects.toThrow(/not an image/i);
});

test("reports an expired token as a reconnect instead of a generic HTTP error", async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockResolvedValueOnce(new Response("unauthorized", { status: 401 }));
  await expect(HiggsfieldSession.open("stale")).rejects.toThrow(/Reconnect Higgsfield/i);
});
