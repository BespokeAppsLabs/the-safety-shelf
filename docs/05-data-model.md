# The Safety Shelf — Data Model

**Convex** (document DB). This is the production schema for `convex/schema.ts`.
The one non-obvious choice carried over from the original plan: **books are
stored as structured blocks, not blobs** — this is what makes translation and
per-locale serving trivial, and powers the in-browser reader.

Decisions locked 2026-07-13 that shape the tables below:
- **Sign-in required before checkout** — no guest checkout / claim flow. `orders.userId` is always set.
- **Categories are an admin-manageable table**, not a hardcoded enum — the owner can add a shelf from the agent/admin without a deploy.
- **`agentActions` is a real table** — an audit log for every propose-then-confirm tool call, not just an implicit side effect.
- **Amends [01-scope-v1](01-scope-v1.md)'s "no custom analytics pipeline" line** — `eventLogs` and `purchaseBehaviourLogs` below are exactly that pipeline, added on direct request. Plain `GROUP BY` over `orders`/`orderItems` still covers revenue/sales stats; these two tables are for funnel and behavioral analysis, not money stats.

## Schema

```ts
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.string(),
    role: v.union(v.literal("owner"), v.literal("customer")),
  })
    .index("by_clerkId", ["clerkId"])
    .index("by_email", ["email"]),

  categories: defineTable({
    slug: v.string(),
    title: v.string(),
    icon: v.optional(v.string()), // emoji, matches current lib/landing.ts shape
    sortOrder: v.number(),
  }).index("by_slug", ["slug"]),

  books: defineTable({
    slug: v.string(),
    title: v.string(),
    author: v.string(),
    priceCents: v.number(),
    status: v.union(v.literal("draft"), v.literal("live"), v.literal("archived")),
    categoryId: v.id("categories"),
    ageGroup: v.string(),
    originalLang: v.string(),
    blurb: v.string(),
    coverStorageId: v.optional(v.id("_storage")),
    epubStorageId: v.optional(v.id("_storage")),
    pdfStorageId: v.optional(v.id("_storage")),
  })
    .index("by_slug", ["slug"])
    .index("by_status", ["status"])
    .index("by_category", ["categoryId"]),
  // One title, one book. Convex has no unique constraint, so the invariant is
  // enforced in code by `assertUniqueTitle` (convex/lib/books.ts), normalized
  // case- and punctuation-insensitively, on EVERY path that can name a book:
  // books.create, books.update (excluding the row itself on rename), and the
  // writeBook + editBook executors in agentActions.approveAndExecute. Slugs
  // auto-suffix on collision (`-2`), so without this a duplicate title looks
  // like a normal save — which is exactly how a second "Pregnancy Safety
  // Basics" reached the live catalog.

  bookBlocks: defineTable({
    bookId: v.id("books"),
    chapter: v.number(),
    ord: v.number(),
    type: v.union(v.literal("h"), v.literal("p"), v.literal("img")),
    text: v.optional(v.string()),
    imgStorageId: v.optional(v.id("_storage")),
  }).index("by_book", ["bookId", "chapter", "ord"]),

  bookVariants: defineTable({
    bookId: v.id("books"),
    lang: v.string(),
    status: v.union(v.literal("draft"), v.literal("live")),
    title: v.optional(v.string()), // falls back to books.title if absent
    blurb: v.optional(v.string()),
    isSaved: v.optional(v.boolean()), // false while new AI output awaits owner save; legacy undefined is readable
  }).index("by_book_lang", ["bookId", "lang"]),

  variantBlocks: defineTable({
    variantId: v.id("bookVariants"),
    chapter: v.number(),
    ord: v.number(),
    type: v.union(v.literal("h"), v.literal("p"), v.literal("img")),
    text: v.optional(v.string()),
    imgStorageId: v.optional(v.id("_storage")),
  }).index("by_variant", ["variantId", "chapter", "ord"]),

  orders: defineTable({
    userId: v.id("users"),
    reference: v.string(), // gateway transaction reference (Paystack)
    providerTransactionId: v.optional(v.string()),
    authorizationUrl: v.optional(v.string()), // resume target; stops rival checkouts
    totalCents: v.number(),
    currency: v.string(), // baseCurrency snapshot — history never re-denominates
    // Only "paid" is revenue. "comp" is an owner freebie, "abandoned" a retired
    // checkout — see docs/10-payments.md and convex/lib/sales.ts.
    status: v.union(
      v.literal("pending"), v.literal("paid"), v.literal("abandoned"),
      v.literal("comp"), v.literal("refunded"),
    ),
    failureReason: v.optional(v.string()), // operator alert; see payments.needingAttention
  })
    .index("by_user", ["userId"])
    .index("by_reference", ["reference"]), // webhook idempotency

  orderItems: defineTable({
    orderId: v.id("orders"),
    bookId: v.id("books"),
    priceCents: v.number(), // snapshot at purchase time, never re-read from books
  })
    .index("by_order", ["orderId"])
    .index("by_book", ["bookId"]), // powers top-sellers / revenue-per-book

  entitlements: defineTable({
    userId: v.id("users"),
    bookId: v.id("books"),
    orderId: v.id("orders"),
    grantedAt: v.number(),
    revokedAt: v.optional(v.number()), // set on the Paystack refund webhook
  })
    .index("by_user", ["userId"]) // My Library
    .index("by_user_book", ["userId", "bookId"]) // isOwned() access check
    .index("by_book", ["bookId"]),

  aiCredentials: defineTable({
    ownerId: v.id("users"),
    provider: v.union(v.literal("openrouter")), // legacy provider values remain schema-compatible
    kind: v.literal("apiKey"),
    encryptedKey: v.optional(v.string()), // encrypted OpenRouter API key
    keyLast4: v.optional(v.string()),
    baseURL: v.optional(v.string()),
        isActive: v.boolean(),
    validatedAt: v.optional(v.number()),
  }).index("by_owner", ["ownerId"]),

  socialAccounts: defineTable({
    platform: v.union(
      v.literal("instagram"), v.literal("facebook"), v.literal("x"),
      v.literal("tiktok"), v.literal("linkedin"),
    ),
    postizChannelId: v.string(),
    status: v.union(v.literal("connected"), v.literal("disconnected"), v.literal("pending_review")),
    connectedAt: v.optional(v.number()),
  }).index("by_platform", ["platform"]),

  socialPosts: defineTable({
    bookId: v.id("books"),
    platform: v.union(
      v.literal("instagram"), v.literal("facebook"), v.literal("x"),
      v.literal("tiktok"), v.literal("linkedin"),
    ),
    postizPostId: v.optional(v.string()),
    status: v.union(v.literal("draft"), v.literal("scheduled"), v.literal("published"), v.literal("failed")),
    content: v.string(),
    mediaStorageId: v.optional(v.id("_storage")),
    scheduledAt: v.optional(v.number()),
    publishedAt: v.optional(v.number()),
  })
    .index("by_book", ["bookId"])
    .index("by_status", ["status"]),

  // Propose-then-confirm audit trail: one row per tool call that writes,
  // spends, or publishes. See docs/03-admin-agent.md.
  agentActions: defineTable({
    tool: v.string(), // e.g. "writeBook", "editBook", "publishBook", "publishSocial"
    // For writeBook this is the ENTIRE unsaved draft (chapters included) — the
    // book has no row until approval, which is why the approvals screen can
    // edit these args in place via agentActions.updateArgs.
    args: v.any(),
    status: v.union(
      v.literal("proposed"), v.literal("approved"), v.literal("rejected"),
      v.literal("executed"), v.literal("failed"),
    ),
    proposedAt: v.number(),
    decidedAt: v.optional(v.number()),
    decidedBy: v.optional(v.id("users")),
    result: v.optional(v.any()),
    relatedBookId: v.optional(v.id("books")),
  })
    .index("by_tool", ["tool"])
    .index("by_status", ["status"]),

  // Full LLM call observability — every agent turn, not just confirm-gated
  // ones. Distinct from agentActions: this is "what ran, which model, what
  // did it cost", agentActions is "what did the owner approve". See
  // docs/07-agent-models.md for the role→model routing this tracks.
  agentLogs: defineTable({
    role: v.union(
      v.literal("orchestrator"), v.literal("writer"), v.literal("reviewer"),
      v.literal("translator"), v.literal("social"), v.literal("analyst"),
    ),
    model: v.string(), // e.g. OpenRouter returned model, snapshot of what actually served the call
    tool: v.optional(v.string()), // unset for plain chat turns with no tool call
    inputTokens: v.number(),
    outputTokens: v.number(),
    latencyMs: v.number(),
    costCents: v.optional(v.number()),
    status: v.union(v.literal("ok"), v.literal("error")),
    errorMessage: v.optional(v.string()),
    relatedActionId: v.optional(v.id("agentActions")), // link when this call backed a confirm-gated tool
  })
    .index("by_role", ["role"])
    .index("by_status", ["status"]),

  // Generic storefront/admin event stream — page views, searches, clicks.
  // Anonymous-friendly: userId is unset until the visitor signs in.
  eventLogs: defineTable({
    type: v.string(), // e.g. "page_view", "search", "category_click"
    userId: v.optional(v.id("users")),
    sessionId: v.string(),
    path: v.string(),
    metadata: v.optional(v.any()),
  })
    .index("by_type", ["type"])
    .index("by_user", ["userId"])
    .index("by_session", ["sessionId"]),

  // Per-book purchase funnel: viewed → sample_opened → checkout_started →
  // purchased | abandoned. Powers conversion-rate stats that orders/orderItems
  // alone can't answer (they only ever see completed purchases).
  purchaseBehaviourLogs: defineTable({
    bookId: v.id("books"),
    userId: v.optional(v.id("users")),
    sessionId: v.string(),
    stage: v.union(
      v.literal("viewed"), v.literal("sample_opened"),
      v.literal("checkout_started"), v.literal("purchased"), v.literal("abandoned"),
    ),
  })
    .index("by_book", ["bookId"])
    .index("by_user", ["userId"])
    .index("by_stage", ["stage"])
    .index("by_session", ["sessionId"]),
});
```

## Why blocks
- **Translate** = LLM over `bookBlocks` → write `variantBlocks` for `(bookId, lang)`. One-click "translate to Spanish" = one tool call; re-run if source changes.
- **Serve** = pick the `bookVariants` row matching reader locale, else the original `books`/`bookBlocks`. **Not wired yet (2026-07-30):** `bookVariants.list` is owner-only and `status` is never set to `"live"`, so no reader-facing query serves a variant. UI chrome is translated; book text is not.
- **Read** = the reader renders blocks; no PDF viewer dependency.
- **Write (AI)** = `writeBook` emits blocks directly.

## Formats are derived, not stored
The current demo (`lib/catalog.ts`) stores `formats: string[]` per book. Production
derives this instead — `hasEpub = !!book.epubStorageId`, `hasPdf = !!book.pdfStorageId`,
"Reader" is always available once `status === "live"`. A stored array would drift
from the actual files; storage-id presence can't lie.

## Categories
`categories` replaces the flat `category: string` field on the demo catalog items.
Owner-manageable so the agent's `writeBook` flow can create a new shelf (e.g.
"Workplace Safety") without a code change — matches the "agent that acts" thesis
in [00-overview](00-overview.md). `lib/landing.ts`'s `LANDING_CATEGORIES` becomes
a query over this table instead of a hardcoded array.

## Currency amendment (2026-07-30)
Two tables added so no currency is hardcoded anywhere in the app. Full design in
[09-i18n-and-pricing](09-i18n-and-pricing.md).

```ts
// Singleton (one row). books.priceCents is minor units OF THIS currency —
// never assumed to be USD. Missing row = prices are not rendered at all.
storeSettings: defineTable({
  baseCurrency: v.string(),
}),

// Owner-managed display rates: 1 unit of baseCurrency = `rate` units of
// `currency`. Display only — orders stay in base-currency minor units, so a
// rate edit never rewrites past revenue.
fxRates: defineTable({
  currency: v.string(),
  rate: v.number(),
  updatedAt: v.number(),
}).index("by_currency", ["currency"]),
```

- The owner prices a book **once**, in the base currency. Every other market's
  price is derived and rounded to a **whole unit — no cents**.
- Currency decimals come from `Intl` ISO data, not a table, so JPY/KRW (0
  decimals) are not priced 100× wrong.
- Display currency follows the shopper's **country**, not their language:
  Arabic spans EGP, LBP, SAR and AED.

## Money source-of-truth
Paystack owns money truth; `orders`/`orderItems` mirror it via a Convex
`httpAction` on the `charge.success` webhook, which also writes `entitlements`.
`orderItems.priceCents` is a **snapshot** at purchase time — `books.priceCents`
can change later without rewriting sales history. See [10-payments](10-payments.md).

An order is written `pending` at checkout initiation and only the signed webhook
promotes it to `paid`. Every sales figure therefore goes through
`convex/lib/sales.ts` → `paidOrderItems`, which ignores lines belonging to
pending or refunded orders; reading `orderItems` directly counts abandoned
checkouts and refunds as revenue.

On a `charge.refunded` webhook: mark `orders.status = "refunded"` and set
`entitlements.revokedAt`. Access checks (`/read/[slug]`, downloads) must treat a
revoked entitlement as no-access, same as none.

## Propose-then-confirm audit trail
Every agent tool that returns a `confirm` block (see [03-admin-agent](03-admin-agent.md))
writes an `agentActions` row on propose, and updates it to `approved`/`rejected`
on the owner's click, then `executed`/`failed` once the underlying mutation/action
runs. This is the record of "who approved what, when" for anything that writes,
spends, or publishes — the core safety mechanism the product is built around,
not just a side effect to infer from other tables.

## Logging (analytics amendment)
`eventLogs` and `purchaseBehaviourLogs` are a deliberate reversal of
[01-scope-v1](01-scope-v1.md)'s "no custom analytics pipeline" line — added on
direct request. Scope note: write from client-side hooks / route handlers as
fire-and-forget `mutation`s; never block a page render or the checkout flow on
a log write succeeding. `agentLogs` is server-side only, written by the agent
runtime itself around every model call.

## Stats
Revenue per book, top sellers, units, conversion-to-purchase — Convex `query`s
aggregating `orders`/`orderItems` (money) and `purchaseBehaviourLogs` (funnel).
Reactive: dashboard + agent cards live-update. No separate analytics platform —
these tables *are* the analytics store, queried directly.

## Access control
`/read/[slug]` and downloads check `entitlements` by `(userId, bookId)` via
`by_user_book`, and must also check `revokedAt` is unset. No entitlement (or a
revoked one) → sample only.

## Demo → production swap points
| Demo (current) | Production |
|---|---|
| `lib/catalog.ts` array | `books` + `bookBlocks` queries |
| `lib/landing.ts` `LANDING_CATEGORIES` | `categories` table query |
| `lib/library.ts` (`localStorage`) | `entitlements` query, scoped to Clerk-authed `userId` |
| Mock "Buy" | Paystack checkout → `orders`/`orderItems`/`entitlements` via webhook |
| `lib/admin.ts` mock stats/queue | `agentActions` + `orders`/`orderItems` aggregate queries |
| No auth | Clerk, synced into `users` by `clerkId` |
| No analytics | `eventLogs` / `purchaseBehaviourLogs` writes from storefront; `agentLogs` from agent runtime |

Nothing in the UI layer changes shape — components already read typed arrays;
only the data source swaps from local files to Convex queries.

## Image generation amendment (2026-07-15)
The schema already carries the durable image handles: `books.coverStorageId` and `bookBlocks.imgStorageId`. `books.kind` is optional during migration (`guide` default, `storybook` for image-forward books) so existing seeded docs do not need a data rewrite before the UI ships. Image bytes live in Convex file storage; readers and store cards resolve storage IDs to URLs at query time.
