# The Safety Shelf — Admin Agent

Built on the **Vercel AI SDK** (tool calling + generative UI). The owner chats;
the agent calls tools; tools return **a component + props**, and the chat renders
that real dashboard card inline. Tools are implemented as **Convex `action`s**
(they call the LLM, Postiz, Paystack); reads are Convex `query`s, writes are `mutation`s.

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
| `researchWeb` | read | WebResearchCard |
| `getBookContent` | read | — (chapters fed back to the model) |
| `writeBook` | draft→confirm | BookDraftCard |
| `editBook` | draft→confirm | ProposalCard |
| `createCover` | draft→confirm | BookDraftCard (cover) |

### One book, one title
`writeBook` creates; `editBook` changes a book that already exists. "Update this
book / add a chapter" must route to `editBook` — routing it to `writeBook` is how
a second copy of a book gets created, since slugs auto-suffix on collision and
nothing else objects. Enforced, not just prompted: `convex/lib/books.ts`'s
`assertUniqueTitle` rejects a duplicate title (normalized, case- and
punctuation-insensitive) on every path that can name a book — `books.create`,
`books.update`, and both executors in `agentActions.approveAndExecute` — and the
`writeBook` tool repeats the check when proposing so the model can correct itself
in the same turn. `editBook`'s `chapters` field is a full replacement, so the
agent must call `getBookContent` first and send back the complete list.

## Review before approve
A proposal card is not just Approve/Reject — every pending proposal that changes
a book also carries **Review**, which opens the full draft. One component
(`components/admin/ProposalActions.tsx`) renders Approve/Reject/Review together,
so the agent chat and `/admin/approvals` offer the identical control; the buttons
themselves stay in `ApprovalControls.tsx` so the dialog can reuse them without an
import cycle.

| Proposal | Review shows |
|---|---|
| `writeBook` | The whole draft, **editable** — title, blurb, price and every chapter |
| `editBook` | What will change, plus the replacement text and a `5 → 6 chapters` count |
| `publishBook` | The existing book's current content, read-only |

`writeBook` is editable because the draft exists **only** as `agentActions.args`
until approval — there is no book row to open in the editor yet.
`agentActions.updateArgs` writes the owner's edits back onto the still-`proposed`
row (owner-only, `writeBook`-only, merges rather than replaces so `categoryId` /
`author` / `ageGroup` survive). Approve then executes what is stored, so the
dialog hides Approve until edits are saved. `editBook` and `publishBook` target
a real book that already has `/admin/books/[slug]`, so their review is read-only.

## Image generation
- Covers and page art remain owner-triggered, and agent image tools still require owner approval before generation.
- A single encrypted OpenRouter key serves all AI paths; no separate image credential exists.
- Covers and chapter art use `google/gemini-3.1-flash-lite-image`, store bytes in Convex, and return OpenRouter's actual usage cost after completion.
- The owner does not enter image prompts. The agent/manual action derives them from book and chapter context; there are no provider/model controls or fixed estimates.

## Web research
- `researchWeb` runs only when the owner asks for current or external research.
- It calls Firecrawl Search from the Convex action with `FIRECRAWL_API_KEY`, returns a maximum of three bounded sources, and renders their links as `WebResearchCard`.
- Results are untrusted reference material. They cannot authorize a write, spend, or publish action.
