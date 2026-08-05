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

// OpenRouter tries `model` first, then each entry in `models`. Keep only true
// fallbacks here or a throttled primary is attempted twice before failover.
//
// GPT-5.6 Luna is the fallback: also a reasoning model with tool calling, and
// the closest match on independent scoring (AA 51 vs DeepSeek's 50), so a
// failover does not quietly downgrade the agent mid-conversation. It costs more
// per output token, which is the right way round for a path that should rarely
// be taken.
export const OPENROUTER_TEXT_FALLBACKS = [
  "openai/gpt-5.6-luna",
] as const;

// Explicit rather than provider-default: every agent route gets the same
// reasoning budget, including fallback requests.
export const OPENROUTER_TEXT_REASONING_EFFORT = "medium" as const;

// Translation only.
//
// This was `google/gemma-4-26b-a4b-it:free`, justified as free capacity for the
// highest-volume text job in the app. But openRouterClient appended the agent's
// fallbacks to EVERY request, so a translation throttle or outage could spill
// into the agent's reasoning route with different cost and output behaviour.
//
// Luna is named here now that the route is honoured (see openRouterTextRequest):
// 1M context, structured outputs, and $0.10/$0.60 per M — the cheapest thing in
// the chain per output token, which is what a whole-chapter rewrite is made of.
// Translation sends no reasoning parameter: requiring it alongside structured
// output excluded compatible providers.
export const OPENROUTER_TRANSLATION_MODEL = "openai/gpt-5.6-luna";

export const OPENROUTER_IMAGE_MODEL = "google/gemini-3.1-flash-lite-image";
