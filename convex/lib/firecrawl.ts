"use node";

import { ConvexError } from "convex/values";

export type WebResearchSource = {
  title: string;
  url: string;
  description?: string;
  content: string;
};

const FIRECRAWL_SEARCH_URL = "https://api.firecrawl.dev/v2/search";
const FIRECRAWL_SCRAPE_URL = "https://api.firecrawl.dev/v2/scrape";

function requireKey() {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) throw new ConvexError("Web research is not configured. Set FIRECRAWL_API_KEY in Convex.");
  return apiKey;
}

// Keep the research tool bounded: it is context for one agent turn, not a web
// archive. Source pages remain untrusted input; the system prompt handles it
// as reference material rather than instructions.
export async function searchWeb(query: string): Promise<WebResearchSource[]> {
  const apiKey = requireKey();

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

// Read ONE page authorized by the caller. `agent.ts` enforces exact provenance;
// this lower-level boundary still rejects non-http(s) input.
//
// The budget is larger than a search hit's (8k vs 3k) because this is a single
// deliberate read rather than three speculative ones, and a regulation page or
// competitor listing is worth little truncated to a few paragraphs.
export async function scrapeUrl(url: string): Promise<WebResearchSource> {
  const apiKey = requireKey();

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ConvexError(`"${url}" is not a valid URL.`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new ConvexError(`Only http and https pages can be read — got "${parsed.protocol}".`);
  }

  const response = await fetch(FIRECRAWL_SCRAPE_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      url: parsed.toString(),
      formats: [{ type: "markdown" }],
      onlyMainContent: true,
    }),
  });
  if (!response.ok) throw new ConvexError(`Could not read ${parsed.hostname} (Firecrawl HTTP ${response.status}).`);

  const payload = await response.json() as {
    data?: { markdown?: string; metadata?: { title?: string; description?: string; sourceURL?: string } };
  };
  const markdown = payload.data?.markdown?.trim();
  if (!markdown) throw new ConvexError(`${parsed.hostname} returned no readable page content.`);

  const metadata = payload.data?.metadata ?? {};
  return {
    title: metadata.title?.trim() || parsed.hostname,
    url: metadata.sourceURL || parsed.toString(),
    description: metadata.description?.trim() || undefined,
    content: markdown.slice(0, 8000),
  };
}
