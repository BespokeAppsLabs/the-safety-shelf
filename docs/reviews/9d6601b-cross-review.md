# Cross-model review — Paystack payments

**Head:** `9d6601b` · **Base:** `main` · **Branch:** `feat/paystack-payments`
**Implementer:** Claude Code (Opus 5) · **Reviewer:** Codex (gpt-5.6-sol, high effort), read-only
**Date:** 2026-08-01

Two threads. REV-01 reviewed the initial implementation; SHEPHERD-02 reviewed the
fixes. Twelve findings, all accepted — no rejections. Two of the reviewer's
factual premises were corrected without changing its conclusions.

## Scope

Replaces the `demoPurchase` stub (any signed-in customer could grant themselves
any book, free) with Paystack hosted checkout and a 55/45 split.

Range `main..9d6601b`, 61 files. Core: `convex/payments/*`, `convex/http.ts`,
`convex/lib/paystack/*`, `convex/lib/sales.ts`, `convex/entitlements/*`,
`convex/schema.ts`, `components/store/BuyButton.tsx`.

## Documents consulted

`AGENTS.md` (Next.js 16 — read `node_modules/next/dist/docs/` before coding),
`docs/01-scope-v1.md` (single owner, no multi-tenant), `docs/05-data-model.md`
(money source-of-truth, honest states), `docs/09-i18n-and-pricing.md` (the
ledger never moves; base currency vs display currency), `.github/workflows/ci.yml`.

External, for disputed gateway behaviour: Paystack refund payloads, webhook event
table, `payment_session_timeout` semantics, Convex action limits.

## Local CI — exact `.github/workflows/ci.yml` `run:` steps

Run with the workflow's env block (placeholder Convex/Clerk keys).

| Step | Result |
|---|---|
| `yarn install --frozen-lockfile` | success |
| `yarn test` | 50 files, **223 tests passed** |
| `yarn build` | compiled, 14 routes incl. `/payments/callback` |
| `npx convex dev --once` | schema pushed, `tsc` clean |

## REV-01 — findings and dispositions

| # | Sev | Finding | Disposition |
|---|---|---|---|
| F1 | P0 | Schema cannot deploy over existing orders | **accept, premise corrected** — dev *was* migrated (transitional → backfill → required, 2 orders, verified). But the migration file had been deleted, so prod/preview could not take the schema. Restored + 3-step sequence documented. |
| F2 | P1 | Refund webhooks discarded | **accept, worse than reported** — `charge.refunded` is a *Stripe* event Paystack never emits, and `refund.processed` keys the original as `transaction_reference`. Refunds were entirely dead code. |
| F3 | P1 | Split fails open | **accept** — missing `PAYSTACK_SPLIT_CODE` produced an unsplit transaction, silently keeping the client's 45%. Now required. |
| F4 | P1 | Two tabs can double-charge | **accept** — traced and confirmed: 2 paid orders, 2 orderItems, 1 repointed entitlement. See redesign below. |
| F5 | P1 | Comps inflate sales | **accept, pre-existing** — not introduced here, but `paidOrderItems` made it the single chokepoint. New `comp` status. |
| F6 | P2 | Public Paystack verify proxy | **accept** — `syncFromGateway` took any reference unauthenticated; an open proxy onto a rate-limited endpoint. Now auth + ownership. |
| F7 | P2 | Amount/currency checks fail open | **accept** — optional args meant a payload omitting them skipped verification. Now required on the success path. |

### F4 — four rounds to converge

1. Proposed: refuse the grant on duplicate. **Reviewer rejected** — the customer is already charged; "mark for refund" is bookkeeping, not remediation. Correct.
2. Proposed: 15-minute stale-pending window. **Withdrawn by implementer** — `payment_session_timeout` is integration-level and *defaults to 0*, so sessions never expire; any clock-based release re-opens the window.
3. Proposed: resume instead of re-create. **Reviewer found two holes** — the URL does not exist at order-creation time (race), and terminality cannot rely on a webhook since abandonment emits no event.
4. Proposed: treat verified `abandoned` as terminal. **Reviewer rejected** — `abandoned` means payment never began, *not* that the URL is dead; with timeout 0 it stays payable, so replacing it re-creates two payable references. **Conceded; `abandoned` now resumes.**

Settled: prevention (one pending order per customer+book, the row is the lock),
release (verified `failed`/`reversed` only), recovery (verify-before-resume),
detection (duplicate flagged to the owner, explicitly *not* remediation).

## SHEPHERD-02 — findings and dispositions

| # | Sev | Finding | Disposition |
|---|---|---|---|
| S2-F1 | P1 | `startCheckout` called `reconcile` without amount/currency after F7 made them mandatory → verification failed, nothing granted, yet `BuyButton` redirected as paid | **accept** — self-inflicted regression. Passes verified values; `alreadyPaid` only on `paid`/`already_paid`; throws when verify succeeds but reconcile refuses. |
| S2-F2 | P1 | Alerts merged into a date-sorted queue then `slice(0,6)`; admin UI never rendered the count | **accept** — payment rows now ordered ahead of content, plus an always-visible stat tile. |
| S2-F3 | P1 | `failureReason` never cleared → alerts forever, no resolution path | **accept, then corrected by reviewer** — first fix *erased* `failureReason`, contradicting the agreed audit retention. Now `alertResolvedAt` stamps resolution and the reason is kept permanently. |
| S2-F4 | P0 | Crashed initializer wedged `preparing` forever | **accept, reviewer's analysis superseded mine** — my "60s is beyond the action lifetime, so no URL was minted" was **false**: actions can run far longer and Paystack mints a payable URL regardless of whether we store it. A taken-over creator could still return a live URL. Fixed with a publication fence (`attachAuthorizationUrl` returns false unless it atomically patches a still-pending order; the URL is never released otherwise). Timer reframed in-code as a takeover grace, not proof of death. |
| S2-F5 | P0 | Docs contradicted the implementation | **accept — first fix incomplete.** `10-payments.md` claimed stale pending never blocks retry, and after the first correction *still* carried the false "no `authorization_url` was ever minted" claim; `05-data-model.md` omitted `alertResolvedAt`. Fully corrected in the final commit on this branch, after the reviewer's post-CI pass caught both. See R-2/R-3 below. |

## Final reviewer pass (post-CI, round cap exhausted)

The reviewer re-audited the pushed head independently and returned NO-GO with
four further findings. All four verified and accepted; none reopened a settled
design question, so they were completed rather than negotiated.

| # | Sev | Finding | Disposition |
|---|---|---|---|
| R-1 | P1 | Legacy `demo:`/`manual:` orders kept `status: "paid"`, so free giveaways still counted as revenue after migration | **accept** — real: 2 dev orders reported ZAR 27.98 of income that never existed. `backfillOrders` gained an independent reclassification pass mapping free-order reference prefixes to `comp`. Re-run on dev: `reclassified: 2`, dashboard revenue now 0. |
| R-2 | P1 | `10-payments.md` still asserted no rival URL is minted during takeover | **accept** — the code comment had been corrected, the doc had not. The doc now states the fence, not the timer, provides safety. |
| R-3 | P2 | `05-data-model.md` omitted `alertResolvedAt` | **accept** — added. |
| R-4 | — | Artifact untracked and recorded S2-F5 as complete | **partly accept** — the artifact *was* committed (`7e731f0`); the reviewer read the tree before that commit. But "S2-F5 complete" was genuinely wrong given R-2/R-3, and this table is the correction. |

## Premises corrected (conclusions unaffected)

- **`charge.failed` does exist** as a Paystack webhook (fires for declines reaching processing), contrary to the reviewer's claim. The reviewer's *conclusion* stands regardless: an abandoned checkout emits **no** event, so webhook terminality is never guaranteed. Nothing depends on it; the handler is labelled defence-only.
- **The F1 "no migration" premise was wrong** for dev, which had already been migrated and verified. The deploy risk for other environments was real and is fixed.

## Agreement

- REV-01: `AGREEMENT: changes` ×4, each implemented; closed with both open items conceded by the implementer, making the reviewer's requested evidence moot.
- SHEPHERD-02: `AGREEMENT: changes` ×2, each implemented; final evidence sent round 4.

**Contribution counts** — parent (Claude) messages: 8 · reviewer (Codex) messages: 8.

The 4-round cap was reached in both threads. The reviewer's final independent
pass was not a fifth negotiation round: every item was a completion of an
already-agreed disposition, verified against the code before being applied.

## Outstanding — for the Boss, not blockers on this diff

1. **`storeSettings.baseCurrency` is `USD`; settlement is ZAR.** Switching it does **not** re-price anything: `priceCents` is currency-agnostic minor units, so a $15 book silently becomes R15 (≈$0.80). Every book must be re-priced in the same change.
2. Paystack dashboard setup (subaccount, split group at 45%/`all-proportional`, webhook) is still pending; `PAYSTACK_SECRET_KEY` on dev is a placeholder used to prove signature verification.
