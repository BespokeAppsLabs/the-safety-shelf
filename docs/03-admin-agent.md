# The Safety Shelf — Admin Agent

Built on the **Vercel AI SDK** (tool calling + generative UI). The owner chats;
the agent calls tools; tools return **a component + props**, and the chat renders
that real dashboard card inline. Tools are implemented as **Convex `action`s**
(they call the LLM, Postiz, Stripe); reads are Convex `query`s, writes are `mutation`s.

## The Tool → Component contract
Every admin capability is one tool (a Next.js server action). A tool (Convex `action`) returns:

```ts
type ToolResult = {
  data: unknown;                 // raw result (for the model to reason over)
  component: string;             // registered component name, e.g. "BookStatsCard"
  props: Record<string, unknown>;// props for that component
  confirm?: {                    // present ⇒ propose-then-confirm
    action: string;             // e.g. "publishBook"
    args: Record<string, unknown>;
    label: string;              // button text, e.g. "Publish to store"
  };
};
```

- The client maps `component` → a React component from a **single registry**.
- The **same registry** powers the dashboard grid and the agent's inline cards.
  Build each card once: `BookStatsCard`, `RevenueChart`, `TopSellersTable`,
  `BookDraftCard`, `SocialPostPreview`.

## Propose-then-confirm (the safety rule)
Any tool that **writes, spends, or publishes** does NOT execute on call. It
returns a `confirm` block; the card renders an **Approve** button; the actual
action runs only when the owner clicks. Read-only tools run freely.

```
Owner: "How's 'The Safety Shelf' doing this month?"
  → getBookStats(bookId, "month")  [read]
  → renders <BookStatsCard/> inline

Owner: "Write a cozy mystery ~15k words, then a cover."
  → writeBook(brief) → createCover(bookId, style)  [drafts]
  → renders <BookDraftCard/> with an Approve-to-save button
```

## Tool catalog
| Tool | Type | Returns component |
|---|---|---|
| `getBookStats` | read | BookStatsCard |
| `getTopSellers` | read | TopSellersTable |
| `getRevenue` | read | RevenueChart |
| `writeBook` | draft→confirm | BookDraftCard |
| `createCover` | draft→confirm | BookDraftCard (cover) |
| `translateBook` | draft→confirm | BookDraftCard (variant) |
| `publishBook` | confirm | BookStatsCard (now live) |
| `generateSocialPost` | draft→confirm | SocialPostPreview |
| `publishSocial` | confirm | SocialPostPreview (posted) |
| `connectSocialAccount` | action | SocialAccountsCard — see [04-social-postiz](04-social-postiz.md) |

## Stats are cheap
Revenue-per-book, top sellers, units, conversion = `GROUP BY` over
`orders`/`order_items`. Stripe is money source-of-truth; Postgres mirrors via
webhook. No analytics platform.

## Image generation plan (locked 2026-07-15)
- Owner-triggered only: generating covers/page art spends real image-provider credits, so UI buttons call explicit actions; agent write tools must still propose before saving generated art.
- Credential source: use the separate Image BYOK row (`purpose === "image"`), never the text/chat credential. Same vendor can be used twice, but as two independent saved keys.
- API: provider adapter selected by the chosen image model; OpenAI and Stability adapters are wired first, with the registry built so additional image APIs add one adapter + model row.
- Storage targets already exist: `books.coverStorageId` for covers and `bookBlocks.imgStorageId` for per-page/storybook images.
- Admin UX: editable prompt + Generate/Regenerate for cover and chapter art; upload can land later if manual art becomes a real need.

## 2026-07-15 image implementation pass
- Corrected image generation actions (`convex/images.ts`) to use the separate Image BYOK credential, selected model, and per-model estimated cost; OpenAI and Stability adapters are wired first.
- Added internal image mutations, Convex storage URL resolution for covers/blocks, admin prompt controls, and public reader/store rendering for generated images.
- Verification: `npm run build` passed on Next.js 16.2.10; `npm test` passed 33 files / 99 tests.


## 2026-07-16 Image Provider Correction
- Root correction: image generation and text generation are separate credential purposes. Same vendor can be used for both, but keys are stored and resolved independently.
- Generation UI selects the image model at spend time and displays an estimated per-image cost before calling the provider.
- Current adapters: OpenAI Image API and Stability Stable Image Core; add new providers by adding one adapter plus model metadata.
- Verified after correction: `npm run build` passed; `npm test` passed 33 files / 99 tests.

## 2026-07-16 local image-generation agent tools
- Added `generateCoverImage` and `generatePageImage` to the live admin agent tool set.
- Both tools are spend-proposal tools: the model can prepare the prompt/model/target and render an approval card, but no image provider call runs until the owner clicks **Approve & generate**.
- The approval card executes the existing `images.generateCover` / `images.generateChapterImage` Convex actions, then marks the `agentActions` row `executed` or `failed`.
- The agent prompt now includes the Safety Shelf image skill: calm educational images, no fear-mongering/gore/tiny text, one teaching idea per page, and Higgsfield credits as billing truth.
