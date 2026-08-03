export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

// Agentic work — the admin agent and social copy. A paid REASONING model on
// purpose.
//
// This was `google/gemma-4-26b-a4b-it:free`, and the free tier was the single
// cause of three separate faults: 429s surfacing as "Invalid JSON response"
// (OpenRouter returns a non-JSON body when throttled), turns that stalled
// because the model wrote "let me create a draft…" instead of emitting the tool
// call, and no way to fail over. A free model behind a 50-request/day cap
// cannot run an agent that has to reliably call tools under a large schema.
//
// Reasoning is a hard requirement, not a preference: a turn may call a tool,
// read a rejection, work out which argument was wrong, and call again — see the
// retry loop in agent.ts. Ling 2.6 Flash was evaluated and rejected for exactly
// this; it is cheap and agent-tuned but exposes no reasoning parameters at all
// (OpenRouter reports none), so the correction step it needs has nowhere to
// happen.
//
// DeepSeek v4 Flash: $0.14/M in, $0.28/M out, 1M context, reasoning_effort,
// native tool calling. ~$1 per thousand agent turns, and half the output price
// of Luna — which matters because writeBook emits whole drafts, so output
// tokens dominate the bill.
export const OPENROUTER_TEXT_MODEL = "deepseek/deepseek-v4-flash";

// Routing list sent to OpenRouter as `models`, tried in order, so a throttle or
// outage on the primary is retried on the next rather than failing the turn.
// The primary must be first — this list replaces the single-model route.
//
// GPT-5.6 Luna is the fallback: also a reasoning model with tool calling, and
// the closest match on independent scoring (AA 51 vs DeepSeek's 50), so a
// failover does not quietly downgrade the agent mid-conversation. It costs more
// per output token, which is the right way round for a path that should rarely
// be taken.
export const OPENROUTER_TEXT_FALLBACKS = [
  "deepseek/deepseek-v4-flash",
  "openai/gpt-5.6-luna",
] as const;

// Translation only. Gemma 4 stays here deliberately: translation is a
// constrained, schema-bound rewrite with no tool calling, which is exactly the
// shape a free model handles reliably — and it is the highest-volume text job
// in the app (21 languages x every chapter), so paying for it would dominate
// spend for no quality gain.
export const OPENROUTER_TRANSLATION_MODEL = "google/gemma-4-26b-a4b-it:free";

export const OPENROUTER_IMAGE_MODEL = "google/gemini-3.1-flash-lite-image";
