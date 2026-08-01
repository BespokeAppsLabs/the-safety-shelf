# The Safety Shelf — Product Overview

## What it is
The Safety Shelf is an online bookstore for a **single store owner**, whose defining feature is an
**agentic admin**: the owner talks to an AI agent that both *does the work*
(writes books, generates covers, translates, publishes, posts to socials) and
*answers with live UI* — it renders a `BookStatsCard` inline in chat instead of
a wall of text.

## The moat
Storefronts are a solved, commodity problem. The differentiator is the admin:

1. **Agent that acts** — every admin task is a tool the agent can call.
2. **Agent that renders UI** — tools return a component + props, not prose.
   The chat transcript renders real dashboard cards inline.
3. **Propose-then-confirm** — the agent drafts anything that writes, spends, or
   publishes and waits for an Approve click. Never one-shots a live action.

Everything else (payments, auth, hosting, social APIs) we **buy or self-host**,
not build.

## Two audiences
- **Owner** → admin dashboard + agent (see [03-admin-agent](03-admin-agent.md)).
- **Reader** → storefront: browse, buy, read, and a personal
  **"My Library"** of purchased books (see [02-storefront](02-storefront.md)).

## Doc map
- [01-scope-v1](01-scope-v1.md) — locked decisions & what's cut from v1
- [02-storefront](02-storefront.md) — reader-facing store + customer accounts
- [03-admin-agent](03-admin-agent.md) — the agent, tool catalog, UI contract
- [04-social-postiz](04-social-postiz.md) — social publishing via Postiz
- [05-data-model](05-data-model.md) — tables & the block-based book model
- [06-stack-and-phases](06-stack-and-phases.md) — stack choices + build order
- [07-agent-models](07-agent-models.md) — which LLM powers each agent role
- [08-ai-auth](08-ai-auth.md) — AI credentials: BYOK now + "sign in with ChatGPT" seam
- [09-i18n-and-pricing](09-i18n-and-pricing.md) — 21 languages, base currency + display FX
- [10-payments](10-payments.md) — Paystack checkout, the 55/45 split, webhook rules
