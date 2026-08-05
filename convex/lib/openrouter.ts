"use node";
import { createOpenAI } from "@ai-sdk/openai";
import {
  OPENROUTER_BASE_URL,
  OPENROUTER_TEXT_FALLBACKS,
  OPENROUTER_TEXT_MODEL,
  OPENROUTER_TEXT_REASONING_EFFORT,
} from "../aiCredentials/providers";

export function openRouterTextRequest(body: Record<string, unknown>) {
  // A draft request includes the large writeBook schema. Require a provider
  // that supports every tool parameter rather than letting OpenRouter send it
  // to a provider that silently ignores tool calling and returns malformed
  // output. Do not send parallel_tool_calls: the free endpoint does not
  // advertise that optional parameter.
  const needsStructuredProvider =
    (Array.isArray(body.tools) && body.tools.length > 0) || body.response_format !== undefined;
  const request = needsStructuredProvider
    ? { ...body, provider: { require_parameters: true } }
    : body;

  // The fallback chain belongs to the agent's route and nothing else. It used
  // to be appended to every chat completion this client sent, and OpenRouter's
  // `models` is the fallback list after `model`, so translation must never
  // inherit the agent route. A caller's chosen model is not a suggestion.
  const isAgentRoute = body.model === OPENROUTER_TEXT_MODEL;
  if (!isAgentRoute) return request;
  return {
    ...request,
    reasoning_effort: request.reasoning_effort ?? OPENROUTER_TEXT_REASONING_EFFORT,
    ...(OPENROUTER_TEXT_FALLBACKS.length ? { models: [...OPENROUTER_TEXT_FALLBACKS] } : {}),
  };
}

// Key setup must validate authentication, not whether a particular free model
// happens to be available. `/key` is an authenticated metadata endpoint and
// does not trigger inference, retries, or model routing.
export async function validateOpenRouterKey(apiKey: string): Promise<void> {
  const response = await fetch(`${OPENROUTER_BASE_URL}/key`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (response.status === 401) throw new Error("OpenRouter rejected this API key.");
  if (!response.ok) throw new Error(`OpenRouter key check failed (HTTP ${response.status}).`);
  const payload = await response.json() as { data?: unknown };
  if (!payload.data) throw new Error("OpenRouter returned an invalid key response.");
}

export function openRouterClient(apiKey: string, useFallbacks = true) {
  return createOpenAI({
    apiKey,
    baseURL: OPENROUTER_BASE_URL,
    fetch: useFallbacks
      ? async (input, init) => {
          const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
          const body = typeof init?.body === "string" && url.endsWith("/chat/completions") ? JSON.stringify(openRouterTextRequest(JSON.parse(init.body))) : init?.body;
          return fetch(input, { ...init, body });
        }
      : undefined,
  });
}
