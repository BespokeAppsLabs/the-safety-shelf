"use node";

import { ConvexError } from "convex/values";

export type WebResearchSource = {
  title: string;
  url: string;
  description?: string;
  content: string;
};

const FIRECRAWL_SEARCH_URL = "https://api.firecrawl.dev/v2/search";

// Keep the research tool bounded: it is context for one agent turn, not a web
// archive. Source pages remain untrusted input; the system prompt handles it
// as reference material rather than instructions.
export async function searchWeb(query: string): Promise<WebResearchSource[]> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) throw new ConvexError("Web research is not configured. Set FIRECRAWL_API_KEY in Convex.");

  const response = await fetch(FIRECRAWL_SEARCH_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      limit: 3,
      sources: ["web"],
      scrapeOptions: { formats: [{ type: "markdown" }], onlyMainContent: true },
    }),
  });
  if (!response.ok) throw new ConvexError(`Web research failed (Firecrawl HTTP ${response.status}).`);

  const payload = await response.json() as {
    data?: { web?: Array<{ title?: string; url?: string; description?: string; markdown?: string }> } | Array<{ title?: string; url?: string; description?: string; markdown?: string }>;
  };
  const results = Array.isArray(payload.data) ? payload.data : payload.data?.web ?? [];
  return results
    .filter((source): source is { title?: string; url: string; description?: string; markdown?: string } => Boolean(source.url))
    .map((source) => ({
      title: source.title?.trim() || source.url,
      url: source.url,
      description: source.description?.trim() || undefined,
      content: (source.markdown ?? source.description ?? "").slice(0, 3000),
    }));
}
