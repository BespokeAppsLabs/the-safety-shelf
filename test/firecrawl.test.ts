import { afterEach, expect, test, vi } from "vitest";
import { searchWeb } from "../convex/lib/firecrawl";

afterEach(() => vi.unstubAllGlobals());

test("searches Firecrawl with bounded markdown results", async () => {
  const previous = process.env.FIRECRAWL_API_KEY;
  process.env.FIRECRAWL_API_KEY = "fc-test";
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
    data: { web: [{ title: "Safety source", url: "https://example.com/safety", description: "A source", markdown: "x".repeat(4000) }] },
  }), { status: 200, headers: { "content-type": "application/json" } }));
  vi.stubGlobal("fetch", fetchMock);

  const sources = await searchWeb("current child safety guidance");
  expect(sources).toEqual([{ title: "Safety source", url: "https://example.com/safety", description: "A source", content: "x".repeat(3000) }]);
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
    query: "current child safety guidance",
    limit: 3,
    sources: ["web"],
    scrapeOptions: { formats: [{ type: "markdown" }], onlyMainContent: true },
  });
  process.env.FIRECRAWL_API_KEY = previous;
});
