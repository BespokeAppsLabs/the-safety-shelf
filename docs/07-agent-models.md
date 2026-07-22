# The Safety Shelf — Agent Model Routing

Strategy: **role-based routing**, not one model. We're on the Vercel AI SDK, so
model choice is a per-call config swap — route everything through **Vercel AI
Gateway** (one API, all providers, per-call selection + failover, no lock-in).

Priority chosen: **Balanced** — a premium model only where correctness guards
spend/publish; cheap open-weight models for high-volume work.

## Landscape snapshot (July 2026 — verify at wire-up, this moves monthly)
| Model | $/1M in | $/1M out | Note |
|---|---|---|---|
| GPT-5.4 | $2.50 | $15 | Premium reliability; Pro tier $30/$180 |
| Kimi K2.7 / K2.6 | $0.95 | $4.00 | 256K ctx; **beats Opus 4.8 on MCP-Mark tool-use (81.1 vs 76.4)** |
| DeepSeek V4 (Flash) | $0.14 | $0.28 | Best price/perf; V3 $0.27/$1.10 |
| GLM-5.2 | $1.40 | $4.40 | Cheap agentic, open weights |

Sources: benchlm.ai/llm-pricing, flowtivity.ai (MCP-Mark tool-use), tech-insider.org. Snapshot only.

## Balanced config (data-driven)
```
Orchestrator ....... Kimi K2.7      # best tool-use benchmark, 1/3 GPT price
Writer ............. Kimi K2.6      # 256K ctx = whole-book coherence, cheap tokens
Reviewer ........... DeepSeek V4    # reasoning critique, near-free
Translator ......... GPT-5.4 (flagship) / DeepSeek V4 (bulk)   # test per language
Social copy ........ GLM-5.2 / DeepSeek V4 Flash              # fast, ~free
Analyst ............ DeepSeek V4    # JSON stats + lead scoring
FINAL QUALITY GATE . GPT-5.4        # the one premium touchpoint before publish
```
The single premium call is the **final quality gate** on anything customer-facing
(flagship manuscripts, translation review) — it sits right before the
propose-then-confirm approval, where the owner clicks Approve. Everything upstream
runs on cheap open weights.

## Why Kimi orchestrates (not GPT)
Original "balanced" assumption was GPT for the orchestrator. Current benchmarks
invert that: Kimi K2.7 leads agentic tool invocation at a fraction of the cost.
Logic over legacy — orchestrator = Kimi, GPT reserved for final quality only.
Keep GPT-5.4 wired as the orchestrator **failover** via the Gateway.

## Data sovereignty (non-negotiable check)
Manuscripts are the owner's **unpublished IP**; customer data is regulated. Do
**not** send either to a provider's own cloud without vetting terms. Route the
open-weight three (Kimi/DeepSeek/GLM) through a neutral Western host
(Fireworks/Together/OpenRouter) or **self-host** — all three have open weights.
GPT-5.4 only for pieces where OpenAI's terms are acceptable.

## Open decisions
- Translation model is **language-specific** — benchmark EN→ES/FR/DE/PT/JP on our
  actual text before locking (see [05-data-model](05-data-model.md) `book_variants`).
- Re-verify prices/versions at implementation; the table above is a snapshot.

See [03-admin-agent](03-admin-agent.md) for the tool catalog these models back.
