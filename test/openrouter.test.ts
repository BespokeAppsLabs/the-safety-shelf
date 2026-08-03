import { afterEach, expect, test, vi } from "vitest";
import { generateText } from "ai";
import { decryptSecret, encryptSecret } from "../convex/lib/secrets";
import { generateOpenRouterImage } from "../convex/images";
import { openRouterClient, openRouterTextRequest, validateOpenRouterKey } from "../convex/lib/openrouter";
import { OPENROUTER_IMAGE_MODEL, OPENROUTER_TEXT_FALLBACKS, OPENROUTER_TEXT_MODEL, OPENROUTER_TRANSLATION_MODEL } from "../convex/aiCredentials/providers";

afterEach(() => vi.unstubAllGlobals());

test("encrypts the one stored OpenRouter key", () => {
  const previous = process.env.AI_CREDENTIALS_ENCRYPTION_KEY;
  process.env.AI_CREDENTIALS_ENCRYPTION_KEY = "test-key";
  const encrypted = encryptSecret("sk-or-secret");
  expect(encrypted).not.toContain("sk-or-secret");
  expect(decryptSecret(encrypted)).toBe("sk-or-secret");
  process.env.AI_CREDENTIALS_ENCRYPTION_KEY = previous;
});

test("routes agentic work to the paid model and sends the fallback chain", async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
    id: "chatcmpl-1",
    object: "chat.completion",
    created: 1,
    model: OPENROUTER_TEXT_MODEL,
    choices: [{ index: 0, message: { role: "assistant", content: "OK" }, finish_reason: "stop" }],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  }), { status: 200, headers: { "content-type": "application/json" } }));
  vi.stubGlobal("fetch", fetchMock);

  await generateText({ model: openRouterClient("sk-or-test").chat(OPENROUTER_TEXT_MODEL), prompt: "ping" });
  const body = JSON.parse(fetchMock.mock.calls[0][1].body);
  expect(body.model).toBe(OPENROUTER_TEXT_MODEL);
  // The agent must not run on a free model: a 50-request/day cap surfaced as
  // unparseable throttle responses and stalled tool calls.
  expect(OPENROUTER_TEXT_MODEL).not.toMatch(/:free$/);
  // A fallback chain is sent, primary first, so a throttle retries instead of
  // failing the turn.
  expect(body.models[0]).toBe(OPENROUTER_TEXT_MODEL);
  expect(OPENROUTER_TEXT_FALLBACKS[0]).toBe(OPENROUTER_TEXT_MODEL);
  expect(OPENROUTER_TEXT_FALLBACKS.length).toBeGreaterThan(1);
  // Translation stays on the free model — schema-bound, no tool calling, and
  // by far the highest-volume text job in the app.
  expect(OPENROUTER_TRANSLATION_MODEL).toMatch(/:free$/);
  expect(openRouterTextRequest({ model: OPENROUTER_TEXT_MODEL, tools: [{ type: "function" }] })).toMatchObject({
    provider: { require_parameters: true },
  });
  expect(openRouterTextRequest({ model: OPENROUTER_TEXT_MODEL, response_format: { type: "json_schema" } })).toMatchObject({
    provider: { require_parameters: true },
  });
});

test("validates a key without sending an inference request", async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { label: "Safety Shelf" } }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);

  await validateOpenRouterKey("sk-or-test");
  expect(fetchMock).toHaveBeenCalledWith("https://openrouter.ai/api/v1/key", {
    headers: { Authorization: "Bearer sk-or-test" },
  });
});

test("stores OpenRouter image bytes and returns the provider's actual cost", async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
    data: [{ b64_json: Buffer.from("image-bytes").toString("base64"), media_type: "image/webp" }],
    usage: { cost: 0.0123 },
  }), { status: 200, headers: { "content-type": "application/json" } }));
  vi.stubGlobal("fetch", fetchMock);

  const result = await generateOpenRouterImage("sk-or-test", "a calm illustration");
  expect(await result.image.text()).toBe("image-bytes");
  expect(result.image.type).toBe("image/webp");
  expect(result.costUsd).toBe(0.0123);
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ model: OPENROUTER_IMAGE_MODEL, prompt: "a calm illustration" });
});

test("every agentic model in the chain supports reasoning and tool calling", () => {
  // The agent loop depends on both: it calls a tool, reads a rejection, works
  // out which argument was wrong, and calls again. Ling 2.6 Flash was dropped
  // here for exposing no reasoning parameters — cheap and agent-tuned is not
  // enough if the correction step has nowhere to happen.
  const REASONING_TOOL_MODELS = ["deepseek/deepseek-v4-flash", "openai/gpt-5.6-luna"];
  expect([...OPENROUTER_TEXT_FALLBACKS]).toEqual(REASONING_TOOL_MODELS);
  expect(OPENROUTER_TEXT_MODEL).toBe(REASONING_TOOL_MODELS[0]);
  expect(OPENROUTER_TEXT_FALLBACKS).not.toContain("inclusionai/ling-2.6-flash");
});
