export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

// Agentic work — the admin agent and social copy. A paid model on purpose.
//
// This was `google/gemma-4-26b-a4b-it:free`, and the free tier was the single
// cause of three separate faults: 429s surfacing as "Invalid JSON response"
// (OpenRouter returns a non-JSON body when throttled), turns that stalled
// because the model wrote "let me create a draft…" instead of emitting the tool
// call, and no way to fail over. A free model behind a 50-request/day cap
// cannot run an agent that has to reliably call tools under a large schema.
//
// TESTING: Ling 2.6 Flash is primary while the new agent loop is exercised.
// It is agent-tuned (vendor-published SOTA-for-size on BFCL-V4 and TAU2-bench)
// and ~13x cheaper than DeepSeek — $0.08 per thousand agent turns — so a heavy
// test session costs pennies. It scores lower on independent indexes (AA 26 vs
// 50) and is a non-reasoning model, so if tool calling proves unreliable in
// practice, swap this line to the DeepSeek id below; the fallback chain and
// everything else stays as-is.
export const OPENROUTER_TEXT_MODEL = "inclusionai/ling-2.6-flash";

// Routing list sent to OpenRouter as `models`, tried in order, so a throttle or
// outage on the primary is retried on the next rather than failing the turn.
// The primary must be first — this list replaces the single-model route.
//
// DeepSeek v4 Flash is the backstop: 1M context, AA index 50, and half the
// output price of the nearest-scoring alternative. It catches anything Ling
// cannot complete, so a weaker primary never costs the owner a failed turn.
export const OPENROUTER_TEXT_FALLBACKS = [
  "inclusionai/ling-2.6-flash",
  "deepseek/deepseek-v4-flash",
] as const;

// Translation only. Gemma 4 stays here deliberately: translation is a
// constrained, schema-bound rewrite with no tool calling, which is exactly the
// shape a free model handles reliably — and it is the highest-volume text job
// in the app (21 languages x every chapter), so paying for it would dominate
// spend for no quality gain.
export const OPENROUTER_TRANSLATION_MODEL = "google/gemma-4-26b-a4b-it:free";

export const OPENROUTER_IMAGE_MODEL = "google/gemini-3.1-flash-lite-image";
