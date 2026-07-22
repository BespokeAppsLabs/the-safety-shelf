# The Safety Shelf — Stack & Build Phases

## Stack
| Concern | Choice | Why |
|---|---|---|
| Frontend | Next.js (App Router) on Vercel | Storefront + admin UI |
| **Backend/API** | **Convex** | Document DB + queries/mutations/actions; reactive by default. Agent tools = Convex `action`s. |
| Auth | Clerk | Native Convex integration; owner + customer accounts, social login |
| Payments | Stripe Checkout | Hosted, no PCI burden. Webhook → Convex `httpAction` |
| Agent | Vercel AI SDK (frontend) → Convex actions (tools) | Tool calling + generative UI; tools run in Convex |
| Covers/images | Image model → Convex file storage | Cover generation + storage |
| UI | shadcn/ui + Tailwind | Shared card library |
| Social | Self-hosted Postiz (Docker) | OAuth connect + posting API; see [04](04-social-postiz.md) |

### What Convex replaces
- **Postgres/Neon** → Convex tables (document model, schema + indexes in `convex/schema.ts`).
- **Next server actions** → Convex functions: `query` (read), `mutation` (write),
  `action` (external I/O — LLM, Postiz, Stripe). Agent tools are `action`s.
- **Stats queries** → Convex `query`s; reactive, so dashboard + agent cards live-update.
- **Stripe webhook endpoint** → Convex `httpAction`.
- **Vercel Blob** → Convex file storage for covers.

The only novel code is the **tool catalog** and the **shared card library** —
~a dozen of each. Everything else is scaffolded or bought.

## Phases
- **Phase 0 — Skeleton:** Next.js + Convex + Clerk + Stripe Checkout + webhook (`httpAction`).
  Books as blocks from day one. Storefront: catalog, detail, reader, **My Library**.
- **Phase 1 — Card library:** `BookStatsCard`, `RevenueChart`, `TopSellersTable`,
  `BookDraftCard`, `SocialPostPreview`, `SocialAccountsCard`. Used by dashboard AND agent.
- **Phase 2 — Agent:** Vercel AI SDK; tool catalog with the Tool→Component
  contract + propose-then-confirm. See [03](03-admin-agent.md).
- **Phase 3 — Content pipeline:** `writeBook` → `createCover` → `translateBook` → `publishBook`.
- **Phase 4 — Social:** stand up Postiz, connect accounts, `generateSocialPost` +
  `publishSocial`. Ship IG/FB/X, queue TikTok behind its audit.

## Current deliverable
**Storefront demo only** (no admin, no DB, no Stripe) — mock data + `localStorage`
purchases to demo browse → buy → **My Library** → read. See
[02-storefront](02-storefront.md) "Demo build".

## 2026-07-15 image phase update
Image generation continues the audiobook pattern: an owner-triggered Convex action uses the separate Image BYOK credential, calls the adapter for the selected image model, stores returned bytes in Convex file storage, then patches either `books.coverStorageId` or a chapter `bookBlocks.imgStorageId`. Text providers and image providers are independent.

## 2026-07-15 image implementation pass
- Corrected image generation actions (`convex/images.ts`) to use the separate Image BYOK credential, selected model, and per-model estimated cost; OpenAI and Stability adapters are wired first.
- Added internal image mutations, Convex storage URL resolution for covers/blocks, admin prompt controls, and public reader/store rendering for generated images.
- Verification: `npm run build` passed on Next.js 16.2.10; `npm test` passed 33 files / 99 tests.


## 2026-07-16 Image Provider Correction
- Root correction: image generation and text generation are separate credential purposes. Same vendor can be used for both, but keys are stored and resolved independently.
- Generation UI selects the image model at spend time and displays an estimated per-image cost before calling the provider.
- Current adapters: OpenAI Image API and Stability Stable Image Core; add new providers by adding one adapter plus model metadata.
- Verified after correction: `npm run build` passed; `npm test` passed 33 files / 99 tests.
