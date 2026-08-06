import { afterEach, expect, test, vi } from "vitest";
import { generateText } from "ai";
import { decryptSecret, encryptSecret } from "../convex/lib/secrets";
import { generateOpenRouterImage } from "../convex/images";
import { openRouterClient, openRouterTextRequest, validateOpenRouterKey } from "../convex/lib/openrouter";
import { COVER_AUTHOR, coverImagePrompt, IMAGE_ASPECT_RATIO, IMAGE_SYSTEM_PROMPT, IMAGE_WEBSITE, pageImagePrompt } from "../lib/imagePrompt";
import {
  OPENROUTER_IMAGE_MODEL,
  OPENROUTER_TEXT_FALLBACKS,
  OPENROUTER_TEXT_MODEL,
  OPENROUTER_TEXT_REASONING_EFFORT,
  OPENROUTER_TRANSLATION_MODEL,
} from "../convex/aiCredentials/providers";

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
  // `model` is attempted first; `models` contains only subsequent fallbacks.
  expect(body.models).toEqual([...OPENROUTER_TEXT_FALLBACKS]);
  expect(OPENROUTER_TEXT_FALLBACKS).not.toContain(OPENROUTER_TEXT_MODEL);
  expect(OPENROUTER_TEXT_FALLBACKS.length).toBeGreaterThan(0);
  expect(body.reasoning_effort).toBe("medium");
  expect(OPENROUTER_TEXT_REASONING_EFFORT).toBe("medium");
  expect(openRouterTextRequest({ model: OPENROUTER_TEXT_MODEL, tools: [{ type: "function" }] })).toMatchObject({
    provider: { require_parameters: true },
  });
  expect(openRouterTextRequest({ model: OPENROUTER_TEXT_MODEL, response_format: { type: "json_schema" } })).toMatchObject({
    provider: { require_parameters: true },
  });
});

test("a non-agent route keeps the model it asked for", async () => {
  // The regression this exists to stop: the agent's fallbacks were appended to
  // EVERY request, so a translation failure could spill into a reasoning model
  // with different cost and structured-output behaviour.
  const translation = openRouterTextRequest({
    model: OPENROUTER_TRANSLATION_MODEL,
    response_format: { type: "json_schema" },
  });
  expect(translation).not.toHaveProperty("models");
  expect(translation).toMatchObject({
    model: OPENROUTER_TRANSLATION_MODEL,
    provider: { require_parameters: true },
  });
  expect(OPENROUTER_TRANSLATION_MODEL).not.toBe(OPENROUTER_TEXT_MODEL);

  // And end to end, through the client the action actually builds.
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
    id: "1", object: "chat.completion", created: 1, model: OPENROUTER_TRANSLATION_MODEL,
    choices: [{ index: 0, message: { role: "assistant", content: "{}" }, finish_reason: "stop" }],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  }), { status: 200, headers: { "content-type": "application/json" } }));
  vi.stubGlobal("fetch", fetchMock);

  await generateText({ model: openRouterClient("sk-or-test").chat(OPENROUTER_TRANSLATION_MODEL), prompt: "ping" });
  const body = JSON.parse(fetchMock.mock.calls[0][1].body);
  expect(body.model).toBe(OPENROUTER_TRANSLATION_MODEL);
  expect(body.models).toBeUndefined();
});

test("translation does not run on a free model", () => {
  // The free tier's 50-request/day cap returns non-JSON throttle bodies, and
  // translation is the highest-volume text job in the app (21 languages x
  // every chapter) — the one job guaranteed to hit that cap.
  expect(OPENROUTER_TRANSLATION_MODEL).not.toMatch(/:free$/);
});

test("validates a key without sending an inference request", async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { label: "Safety Shelf" } }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);

  await validateOpenRouterKey("sk-or-test");
  expect(fetchMock).toHaveBeenCalledWith("https://openrouter.ai/api/v1/key", {
    headers: { Authorization: "Bearer sk-or-test" },
  });
});

test("stores OpenRouter image bytes and sends the target display ratio", async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
    data: [{ b64_json: Buffer.from("image-bytes").toString("base64"), media_type: "image/webp" }],
    usage: { cost: 0.0123 },
  }), { status: 200, headers: { "content-type": "application/json" } }));
  vi.stubGlobal("fetch", fetchMock);

  const prompt = coverImagePrompt({ title: "A Calm Guide", blurb: "Staying safe" });
  const result = await generateOpenRouterImage("sk-or-test", prompt, "cover");
  expect(await result.image.text()).toBe("image-bytes");
  expect(result.image.type).toBe("image/webp");
  expect(result.costUsd).toBe(0.0123);
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
    model: OPENROUTER_IMAGE_MODEL,
    prompt,
    aspect_ratio: "2:3",
  });
  expect(prompt.startsWith(IMAGE_SYSTEM_PROMPT)).toBe(true);
  expect(prompt).toContain(`Book author: ${COVER_AUTHOR}`);
  expect(prompt).toContain(`"${IMAGE_WEBSITE}"`);
  expect(prompt).not.toContain("deep emerald with restrained amber accents");
  const migratedPrompt = coverImagePrompt({ title: "A Calm Guide", blurb: "Staying safe" }, "Create one polished, edge-to-edge editorial illustration for The Safety Shelf. Use deep emerald and a shelf/shield motif.");
  expect(migratedPrompt).not.toContain("Additional direction:");
  expect(migratedPrompt).not.toContain("Use deep emerald");
  expect(pageImagePrompt({ title: "A Calm Guide" }, 1, "Stay safe")).toContain(`"${IMAGE_WEBSITE}"`);
  expect(IMAGE_ASPECT_RATIO.page).toBe("1:1");
});

test("every agentic model in the chain supports reasoning and tool calling", () => {
  // The agent loop depends on both: it calls a tool, reads a rejection, works
  // out which argument was wrong, and calls again. Ling 2.6 Flash was dropped
  // here for exposing no reasoning parameters — cheap and agent-tuned is not
  // enough if the correction step has nowhere to happen.
  const REASONING_TOOL_MODELS = ["deepseek/deepseek-v4-flash", "openai/gpt-5.6-luna"];
  expect([OPENROUTER_TEXT_MODEL, ...OPENROUTER_TEXT_FALLBACKS]).toEqual(REASONING_TOOL_MODELS);
  expect(OPENROUTER_TEXT_MODEL).toBe(REASONING_TOOL_MODELS[0]);
  expect(OPENROUTER_TEXT_FALLBACKS).not.toContain("inclusionai/ling-2.6-flash");
});
