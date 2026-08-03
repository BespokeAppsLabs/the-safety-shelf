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

## The turn loop

A turn runs up to **6 steps** (`stopWhen: [stepCountIs(6), proposalSucceeded]`),
so the model can call a tool, read the result, and act on it within one turn.

**A failed tool call no longer ends the turn.** The stop condition was
`hasToolCall(...PROPOSAL_TOOL_NAMES)`, which fired the moment a proposal tool
was *called* — so a call rejected by its own validation ("Unknown category …")
ended the turn with no card and no correction, and the model never learned it
had failed. `proposalSucceeded` now stops only on a proposal that produced a
real card, leaving budget to read the error and retry.

**Convex rejections reach the model.** A validator error thrown inside a tool
used to escape `generateText` and kill the whole turn — the owner saw "Chat
failed" and the agent could not see which argument was wrong. `reportingTools`
catches it and returns it as a tool *result*:

> `writeBook was rejected: <Convex's message>. Correct the arguments and call
> writeBook again — do not tell the owner it succeeded.`

## What the model remembers

History used to be flattened to `{ role, content }`, so tool calls and results
vanished when a turn ended. The agent restarted every turn blind — unable to
tell a tool it had *run* from one it had only *talked about*, which are the same
thing once the trace is gone.

Each turn now persists its real transcript (`modelMessages`) and replays it:

- `transcriptFromSteps` rebuilds it from **every** step. `result.response
  .messages` carries only the final step, so persisting that kept the closing
  prose and dropped the tool calls that produced it.
- Tool outputs are tagged as `{ type: "json", value }`. A step's tool-result
  holds the tool's **raw** return, while the protocol requires a tagged
  `ToolResultOutput`; passing steps through unchanged produced *"The messages do
  not match the ModelMessage[] schema"* on the **next** turn — so a chat broke
  as soon as it had history worth replaying. `normaliseStored` repairs rows
  written before that fix, rather than leaving those chats permanently dead.
- Reasoning parts are excluded: not needed to understand what was attempted, and
  some providers reject replayed reasoning tokens.
- Only the last **4 turns** replay in full (`TRANSCRIPT_TURNS`). A `writeBook`
  result carries an entire draft; replaying every one would exhaust the context
  window on history alone. Older turns keep their prose.

Approval outcomes reach the model separately: `buildSystemPrompt` injects
`agentActions.recent` with `proposed | approved | rejected | executed | failed`,
plus the invariant that only `[executed]` proves a write happened.

## Tool visibility in the thread

Every assistant turn states which tools it ran, and says so when it ran none —
*"No tools used — nothing was created or changed."* That is the tell for the
narration failure above, which was otherwise indistinguishable from real work.

A turn with **no record** (`tools: undefined`) renders nothing. Everything
written before tracking existed has no record, and many of those did call tools;
reporting them as "no tools used" would assert something false about the
thread's own history. `[]` means "genuinely ran nothing" and is preserved
end-to-end.
