# The Safety Shelf — OpenRouter Routing

All AI runs on the owner's encrypted OpenRouter key. Which model handles a job
depends on what the job actually needs.

## Agentic work — a paid reasoning model

`convex/aiCredentials/providers.ts`:

| | Model | Why |
|---|---|---|
| Primary | `deepseek/deepseek-v4-flash` | reasoning + tool calling, 1M context, $0.14/M in · $0.28/M out |
| Fallback | `openai/gpt-5.6-luna` | reasoning + tool calling, scores within a point (AA 51 vs 50) |

Both are sent as OpenRouter's `models` routing list, primary first, so a
throttle or provider outage retries on the next instead of failing the turn.
Roughly **$1 per thousand agent turns**.

**Reasoning is a requirement, not a preference.** A turn may call a tool, read a
rejection, work out which argument was wrong, and call again — see the retry
loop below. Ling 2.6 Flash was evaluated and rejected for exactly this: cheap
and agent-tuned, but OpenRouter reports no reasoning parameters for it at all,
so the correction step has nowhere to happen. `test/openrouter.test.ts` asserts
the chain, so a future cost-driven swap has to argue with a failing test.

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

## Translation — deliberately still free

`google/gemma-4-26b-a4b-it:free` via `OPENROUTER_TRANSLATION_MODEL`.

Translation is a constrained, schema-bound rewrite with no tool calling — the
shape a free model handles reliably — and it is the highest-volume text job in
the app (21 languages × every chapter). Paying for it would dominate spend for
no quality gain.

## Tool routing

Agent turns that expose tools set `provider: { require_parameters: true }`, so
OpenRouter only routes to a provider supporting every supplied parameter. This
stops a draft request reaching a provider that silently ignores tool calling and
returns malformed output.

## Images and audio

Cover and chapter art use `google/gemini-3.1-flash-lite-image`. Generation
responses carry actual cost; there are no pre-generation estimates or model
selectors. ElevenLabs remains independent for audiobook narration.
