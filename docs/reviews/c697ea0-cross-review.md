# Cross-model review — Paystack currency work (round 3)

**Head:** `c697ea0` · **Base:** `main` · **Branch:** `feat/paystack-payments` · **PR:** #1
**Implementer:** Claude Code (Opus 5) · **Reviewer:** Codex (gpt-5.6-sol, high effort), read-only
**Date:** 2026-08-03

Continues `9d6601b-cross-review.md` (16 findings, all accepted, through `9d6601b`).
This round covers only the currency work that landed after it.

## Scope — `2561998..c697ea0`

| Commit | Change |
|---|---|
| `2561998` | Reclassify legacy free orders to `comp`; correct payment docs |
| `4602a8d` | Default display currency USD; exact-charge disclosure at checkout |
| `32a9f48` | Allow unsplit checkout on TEST keys only; live stays hard-blocked |
| `c697ea0` | Step down to USD when the shopper's currency has no fx rate |

## Local CI — exact `.github/workflows/ci.yml` steps

| Step | Result |
|---|---|
| `yarn install --frozen-lockfile` | success |
| `yarn test` | 50 files, **226 passed** |
| `yarn build` | compiled |
| `npx convex dev --once` | schema + functions pushed, `tsc` clean |

## Verified against the live Paystack test account

- Account is **ZAR**. `initialize` in ZAR succeeds; the same call in USD returns
  **"Currency not supported by merchant"** — charging dollars is impossible here.
- `GET /integration/payment_session_timeout` → **0**: sessions never expire,
  confirming the resume-don't-replace design from round 2 was necessary.
- `baseCurrency` = ZAR, 9 books repriced R99–R299, `fxRates` holds USD only.

## Round 1 — brief sent

Question put to the reviewer: *"What material defects or doctrine drift remain in
`2561998..c697ea0`?"*, with attention to money correctness, whether display-vs-charge
currency can mislead, the soundness of `isLiveMode()` as a liveness signal, the fx
step-down chain, rounding, and whether `switchBaseToZar` is safe beyond dev.

## Round 1 — findings and dispositions

Six findings. Five accepted, one rejected with evidence.

| # | Sev | Finding | Disposition |
|---|---|---|---|
| S3-F1 | P1 | `Price.tsx` discloses today's price while a resumed checkout charges its snapshot | **accept** — confirmed: `BuyButton` passed `book.priceCents`, but resume hands back the stored `authorizationUrl` whose session carries the snapshot, and `payment_session_timeout` is 0 so it stays payable. This PR ships a repricing migration, so the two genuinely diverge. Fix: `payments.pendingCheckout` returns the open order's `{totalCents, currency}`; `BuyButton` prices and discloses from that when present. |
| S3-F2 | P1 | Switching base leaves non-USD fx rates denominated against the old base | **accept** — `fxRates` means "1 base = rate × currency", so a EUR row written against USD would claim `1 ZAR = 0.92 EUR`, out by ~18.5×. Only USD was upserted. Fix: divide every existing rate by `usdToZar` in the same transaction. |
| S3-F3 | P1 | `docs/10-payments.md:161` instructs setting ZAR in Admin, which cuts prices ~95% | **accept** — `setBaseCurrency` relabels without converting. Fix: replaced with the migration dry-run/apply commands and a verification list. |
| S3-F4 | P1 | Migration treats any non-ZAR base as USD | **accept** — only guard was `=== "ZAR"`; a EUR catalogue would be multiplied by a dollar rate. Fix: require `baseCurrency === "USD"`. |
| S3-F5 | P2 | First uncookied request renders base currency | **accept** — `proxy.ts` returned `NextResponse.next()` with no request-header forwarding while `layout` reads incoming cookies, so a first-time visitor got no currency and fell back to rand. Fix: proxy forwards `x-tss-locale`/`x-tss-currency` on the request; layout prefers them, cookies still persist the picker choice. |
| S3-F6 | P2 | `toLadderPrice` adds ~7.7% markup rather than converting | **reject as defect, accept as documentation gap** — the owner was shown this ladder and straight nearest-rand conversion side by side, per book, and chose the ladder. Setting list prices is a pricing decision; `docs/09-i18n-and-pricing.md:102` scopes nearest-whole rounding to `convertToWholeUnits` display conversion of a fixed base price. Approval now recorded in the migration header. **Reviewer accepted this rejection, citing the same line.** |

### Verification of the S3-F5 fix

First request, no cookies, `x-vercel-ip-country` set:

| Country | Before | After |
|---|---|---|
| JP | ZAR | **USD** |
| IS | ZAR | **USD** |
| ZA | ZAR | **ZAR** (correct — base is their currency) |

## Agreement

`SHEPHERD-S3-R2 AGREEMENT: ready` — reviewer confirmed S3-F1..F5 fixes match the
accepted root causes and requested no further changes.

**Contribution counts** — parent (Claude) messages: 2 · reviewer (Codex) messages: 2.

## Local CI after the fixes

`yarn install --frozen-lockfile` ✓ · `yarn test` **227 passed** ✓ · `yarn build` compiled ✓ ·
`npx convex dev --once` clean ✓
