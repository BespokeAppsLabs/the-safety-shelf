# The Safety Shelf — v1 Scope

Decided 2026-07-05.

## Locked
| Decision | Choice | Why |
|---|---|---|
| Product type | **Digital-only** (EPUB/PDF + read-online) | No shipping/inventory. Makes translation, one-click publish, instant delivery trivial. |
| Agent autonomy | **Propose-then-confirm** | LLM drafts; owner clicks Approve before any write/spend/publish. |
| Social publishing | **Self-hosted Postiz** | Open-source OAuth "connect your accounts" + REST API. See [04-social-postiz](04-social-postiz.md). |
| Customer accounts | **Yes — simple** | Sign in → **My Library** of purchased books. See [02-storefront](02-storefront.md). |
| Tenancy | **Single owner** | No multi-tenant SaaS scaffolding. |

## Cut from v1 (defer)
- Physical books / shipping / inventory / print-on-demand → Phase 2.
- Multi-tenant / multiple store owners.
- Reviews, wishlists, recommendation engine.

## Amended 2026-07-13
- ~~Custom analytics event pipeline~~ — reversed on direct request. `eventLogs`,
  `purchaseBehaviourLogs`, and `agentLogs` are now in the schema; see
  [05-data-model](05-data-model.md). Money stats (revenue, top sellers) still
  come from plain `GROUP BY` over `orders`/`orderItems` — the new tables are
  for funnel/behavioral analysis and agent-call observability, not a
  replacement for that.

## Hard external constraints (not ours to fix)
- **X charges to post** (~$0.20/post-with-link, or a paid API tier). Budget line.
- **TikTok requires a sandbox audit** — posts forced *private* until approved,
  and it's video-first (needs a generated video asset, not just a cover).
- **Meta (IG/FB)** OAuth needs a Business account + app review, but posting is free.

**Honest v1 social promise:** one-click to **IG / FB / X now**, **TikTok once approved**.
