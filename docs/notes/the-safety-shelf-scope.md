---
name: the-safety-shelf-scope
description: Locked v1 scope + stack decisions for The Safety Shelf
metadata: 
  node_type: memory
  type: project
  originSessionId: d5f66691-7c59-4f2b-9d15-ee62f3929dcd
---

The Safety Shelf is an online bookstore for a single store owner, with an agentic admin. The moat is the AI admin agent that both does tasks (write books, gen covers, translate, publish, social) AND answers with live UI components (renders BookStatsCard etc. inline instead of text).

**Locked v1 decisions (2026-07-05):**
- Digital-only (EPUB/PDF + read-online). No physical/inventory/shipping in v1; print-on-demand deferred.
- Agent is propose-then-confirm on every write/spend/publish: drafts → Approve button → executes.
- Social publishing via self-hosted **Postiz** (open-source, OAuth "connect your accounts" + REST API the agent calls). Fallback = Ayrshare managed if ops not wanted. Postiz is the token vault; our app holds one Postiz API key, never raw social tokens. Connect flow links out to Postiz UI; list/draft/publish/disconnect via API.
- **Customer accounts (simple)** via Clerk: readers sign in → **My Library** of purchased books (entitlements table = user_id+book_id). Access control on /read + downloads checks entitlement.

**Docs:** full design set lives in `docs/00..09-*.md` (overview, scope, storefront, admin agent, social publishing, data model, stack, model routing, AI auth, and content pipeline).

**Current implementation (verified 2026-07-21):**
- `the-safety-shelf/` — Next.js 16.2.10 app using the Safety Shelf paper/green brand system, with marketing, storefront, reader, and owner-admin route groups.
- Live Convex-backed agentic admin, propose-then-confirm approvals, book editing, translations, ElevenLabs audio, and image generation adapters.
- Verification after the repository rename: 104 Vitest tests across 34 files passed; the production build completed successfully.
- `docs/The-Safety-Shelf-Features.pdf` (+ `features.html` source) — branded 3-page plain-language feature sheet for the store owner.

**Shipped (2026-07-05):**
- GitHub (public): https://github.com/BespokeAppsLab/the-safety-shelf — single repo at the_safety_shelf root (docs + the-safety-shelf app), branch `main`. gh account BespokeAppsLab.
- Vercel (prod, public): https://midnight-library-lovat.vercel.app — deployed via `vercel deploy --prod` from inside `the-safety-shelf/`. Vercel scope bespokeappslabs, project `midnight-library`.
- Boss wants the repo **public** for hosting (corrected an initial private default).

**AI credentials/auth decision (2026-07-09, docs/08-ai-auth.md):** Boss wants "sign in with ChatGPT" like openclaw/opencode. Verdict: the openclaw method = Codex OAuth proxy, which is **ToS-barred for commercial/production apps** (personal-use only, bannable, fragile) — do NOT ship it. Instead: **ship BYOK (API key) now** — provider-agnostic because OpenAI/DeepSeek/Kimi/GLM are all OpenAI-compatible (one code path: createOpenAI({baseURL,apiKey})). Build a credential-provider **seam** (apiKey adapter now + chatgptOAuth adapter flagged-off) so OpenAI's OFFICIAL "Login with ChatGPT" device-code flow (posted Jun 26 2026, usage draws from user's ChatGPT plan) drops in when it's GA + commercially licensed. Keys stored encrypted in Convex, server-side only, never in browser. Model routing plan (per-role, balanced) in docs/07-agent-models.md; current-gen models: GPT-5.4, Kimi K2.7/K2.6, DeepSeek V4, GLM-5.2.

**Stack:** Next.js on Vercel (frontend) · **Convex** for backend/API (document DB + query/mutation/action, reactive) · Clerk auth (native Convex integration) · Stripe Checkout (webhook → Convex httpAction) · Vercel AI SDK on frontend with agent **tools implemented as Convex actions** · covers → Convex file storage · shadcn/ui. Convex replaces Postgres/Neon, Next server actions, and Vercel Blob. Stats = reactive Convex queries.

**Key design:** books stored as structured blocks (chapters→paragraphs), not blobs — makes translation (per-block LLM → book_variants keyed by (book_id, lang)) and per-locale serving trivial. Dashboard cards and agent inline cards are the SAME React components. Every admin capability = one tool returning { data, component, props }.

**Hard external constraints:** X charges ~$0.20/post to publish (X's fee). TikTok requires a sandbox audit — posts forced private until approved — and is video-first (needs a generated video asset, not just a cover). So v1 honest promise: one-click IG/FB/X now, TikTok once approved.

Stats = plain GROUP BY over orders/order_items; Stripe is money source-of-truth, Postgres mirrors via webhook. No analytics platform needed.
