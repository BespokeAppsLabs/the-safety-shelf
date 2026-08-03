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

_Findings and dispositions appended below as the exchange proceeds._
