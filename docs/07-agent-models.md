# The Safety Shelf — OpenRouter Routing

All AI runs on the owner's encrypted OpenRouter key. Which model handles a job
depends on what the job actually needs.

## Agentic work — a paid reasoning model

`convex/aiCredentials/providers.ts`:

| | Model | Why |
|---|---|---|
| Primary | `deepseek/deepseek-v4-flash` | reasoning + tool calling, 1M context, $0.14/M in · $0.28/M out |
| Fallback | `openai/gpt-5.6-luna` | reasoning + tool calling, scores within a point (AA 51 vs 50) |

DeepSeek is sent as `model`; `models` contains only Luna as the subsequent
fallback. A throttle or provider outage therefore fails over once instead of
retrying the primary. Roughly **$1 per thousand agent turns**.

**Reasoning is a requirement, not a preference.** A turn may call a tool, read a
rejection, work out which argument was wrong, and call again — see the retry
loop below. Ling 2.6 Flash was evaluated and rejected for exactly this: cheap
and agent-tuned, but OpenRouter reports no reasoning parameters for it at all,
so the correction step has nowhere to happen. The routing layer explicitly
sends `reasoning_effort: "medium"`; it does not depend on a provider default.
`test/openrouter.test.ts` asserts the complete serialized request.

### What this replaced, and why

The agent ran on `google/gemma-4-26b-a4b-it:free` with an empty fallback array.
One cause, three faults:

- **"Invalid JSON response"** — OpenRouter returns a non-JSON body when
  throttling a free key, and the AI SDK surfaces the parse failure rather than
  the throttle. The real reason (status, body) was discarded by the catch block.
- **Stalled turns** — the model wrote "let me create a draft…" instead of
  emitting the tool call. No tool call, no card, nothing happened.
- **No failover** — `OPENROUTER_TEXT_FALLBACKS` was empty, so `models` was never
  sent and there was nothing to fall back to.

Free-tier limits are **50 requests/day** on an account that has never purchased
credits (1,000/day after $10, permanently). An agent that must reliably call
tools under a large schema cannot live inside that.

## Translation

`openai/gpt-5.6-luna` via `OPENROUTER_TRANSLATION_MODEL`. No reasoning
parameter is sent: `TRANSLATION_OPTIONS` is empty because requiring that
parameter alongside structured output excluded compatible OpenRouter providers.

### Why translation has an isolated route

This was `google/gemma-4-26b-a4b-it:free`, on the reasoning that translation is
a schema-bound rewrite and the highest-volume text job in the app (21 languages
× every chapter), so paying for it would dominate spend for no quality gain.

`openRouterClient` used to append the agent's fallbacks to **every** chat
completion. That made a translation throttle or outage eligible to spill into
an agent reasoning model with different cost and structured-output behaviour.
The requested translation model was not an isolated route.

Three changes, one cause suppressed:

- `openRouterTextRequest` sends Luna as a fallback **only** after the agent's
  primary `model`. Translation receives no `models` field.
- Translation names Luna: 1M context, structured outputs, and $0.10/$0.60 per M
  — the cheapest per output token in the chain, which is what a whole-chapter
  rewrite is made of.
- Chapter output is raised to 8k tokens. No reasoning parameter is sent, so the
  route stays compatible with structured-output providers.

Regression cover: `test/openrouter.test.ts` asserts a non-agent route keeps its
own model and is sent no `models` list.

## Tool routing

Agent turns that expose tools set `provider: { require_parameters: true }`, so
OpenRouter only routes to a provider supporting every supplied parameter. This
stops a draft request reaching a provider that silently ignores tool calling and
returns malformed output.

## Images and audio

Cover and chapter art use `google/gemini-3.1-flash-lite-image`. Generation
responses carry actual cost; covers use portrait `2:3` output and chapter art
uses square `1:1` output to match their display frames. A shared Safety Shelf
image prompt supplies the safety, crop-safe, and no-watermark rules.
It forbids brand colours and motifs, adds only `safety-shelf.co.za` as branding
in small text along the bottom, and places `T.C Lekitlane` on every cover.
There are no pre-generation estimates or model selectors. ElevenLabs remains
independent for audiobook narration.
