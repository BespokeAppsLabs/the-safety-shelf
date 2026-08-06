# Cross-model review — Admin mobile navigation

**Head:** `8e8a724` · **Base:** `main` · **Branch:** `feat/admin-mobile-nav`
**Implementer:** Claude Code (Opus 5) · **Reviewer:** Codex (gpt-5.6-sol, high effort), read-only
**Date:** 2026-08-06

Base is `main`, not `dev`: this repository has no `dev` branch and
`.github/workflows/ci.yml` triggers on `pull_request`/`push` to `main` only.
The live Codex session already open on this worktree was reused as the
reviewer rather than spawning a fresh one.

## Scope — `57d2d2f..8e8a724`

| Commit | Change |
|---|---|
| `8e8a724` | Burger + native `<dialog>` drawer for the admin nav below `lg` |

Files:

- `components/admin/AdminMobileNav.tsx` (new, 132 lines, client component)
- `app/(admin)/admin/layout.tsx` (topbar composition only)

The defect being fixed: `app/(admin)/admin/layout.tsx:38` renders the sidebar
`hidden lg:block`, and nothing else in the layout carried `ADMIN_NAV`. Below
1024px the admin navigation did not exist in the DOM at all — an owner on a
phone could reach `/admin` and then not leave it except by typing URLs.

## Documents consulted

| Document | Bearing on this change |
|---|---|
| `AGENTS.md` | Next.js in this repo diverges from training data; read `node_modules/next/dist/docs/` before writing. Done — see below. |
| `docs/02-storefront.md:22` "Header navigation" | Active-page marking doctrine: filled pill + `aria-current="page"`, `/` matches only itself, everything else covers sub-routes. The drawer follows the same rule shape (`/admin` matches only itself). |
| `docs/00-overview.md`, `docs/03-admin-agent.md` | Owner-only admin surface; no responsive/mobile doctrine is stated anywhere, so this is a gap being filled, not a doctrine change. |
| `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-pathname.md` | `usePathname` is client-only; hydration-mismatch caveat applies to statically prerendered routes with rewrites. Every `/admin/*` route builds as `ƒ` (dynamic) and `next.config.ts` does not enable `cacheComponents`, so neither caveat applies. |
| `components/ui/Dialog.tsx` | Existing native-`<dialog>` pattern in this codebase — reused as a pattern, deliberately not as a component (see F0 below). |
| `components/store/StoreHeader.tsx` | Prior art for `isActive` and for the brand lockup that the drawer header mirrors. |

## Local CI — exact `.github/workflows/ci.yml` steps

Run via `~/.codex/skills/shepherd/scripts/local-ci-gate.sh` at `8e8a724`.

| Step | Result |
|---|---|
| `yarn install --frozen-lockfile` | success (already up to date) |
| `yarn test` | 56 files, **267 passed**, 0 failed |
| `yarn build` | compiled in 3.0s, TypeScript clean, 16 pages generated |

## Self-declared points for the reviewer to attack

- **F0 — not reusing `components/ui/Dialog.tsx`.** That component hardcodes
  `m-auto w-full max-w-2xl` and wraps children in `max-h-[85vh] overflow-y-auto`
  — a centred, height-capped modal. A left-anchored full-height drawer needs
  `m-0 h-full w-80`. Reuse would mean adding a variant prop to a component with
  one shape and one caller set. Claim: a separate element is the smaller change.
- **F0b — no test.** The repo has no DOM test infrastructure (no jsdom, no
  Testing Library; `vitest` runs `edge-runtime` and `convex-test` suites only).
  The only pure logic here is `isActive`, duplicated in shape from
  `StoreHeader.tsx:38`. Claim: extracting it to `lib/nav.ts` for one assertion
  is the arguable fix; adding a DOM test stack for a burger is not.
- **F0c — `aria-current` asymmetry.** The drawer marks the active link; the
  desktop sidebar at `layout.tsx:47-55` never has. Pre-existing gap, adjacent to
  this diff, not caused by it.

## Round 1 — brief sent

Question put to the reviewer: *"What material defects or doctrine drift remain
in `57d2d2f..8e8a724`?"*, with attention to the `<dialog>` lifecycle under React
18/19 StrictMode double-effects, focus management, whether the drawer can trap
clicks when the viewport crosses `lg` while open, the `pathname`-keyed close
effect, and the three self-declared points above.

## Round 1 — findings and dispositions

Two findings, both **accepted**. Both verified in the source before agreeing.

| # | Sev | Finding | Disposition |
|---|---|---|---|
| R1-F1 | P2 | `AdminMobileNav.tsx:62` — crossing into `lg` leaves the drawer open and the desktop workspace inert. Only the opener is `lg:hidden`; nothing clears `open` on a viewport change, and `showModal()` makes everything outside the dialog inert. | **accept** — confirmed. The `lg:hidden`-on-the-dialog trap I documented at line 62 is real, but I only avoided it; I did not close the other half. A window resize past `64rem` (desktop resize, tablet rotation) reveals the sidebar with a full-height drawer sitting on top of it. Fix: a `matchMedia("(min-width: 64rem)")` `change` listener that clears `open`, attached only while open. `rem` not `px`, so it tracks the root font size exactly as the Tailwind `lg` class does. |
| R1-F2 | P3 | `AdminMobileNav.tsx:42` — selecting the already-current admin item does not close the drawer. `usePathname` is unchanged for a same-URL `Link`, so the effect never reruns. | **accept** — confirmed by reading the effect's dependency array. Fix: `onClick={() => setOpen(false)}` on the `ADMIN_NAV` links, keeping the `pathname` effect for back/forward. Scoped to `ADMIN_NAV` only: the brand link (`/`) and "Open store" (`/store`) always change the pathname from an `/admin/*` route, so they cannot hit this. |

F0, F0b and F0c drew no challenge from the reviewer and stand as written.

Both fixes landed in `7444b40`.

## Local CI after the round-1 fixes — head `7444b40`

| Step | Result |
|---|---|
| `yarn install --frozen-lockfile` | success |
| `yarn test` | 56 files, **267 passed** |
| `yarn build` | compiled in 2.3s, TypeScript clean |

## Round 2 — findings and dispositions

The reviewer confirmed R1-F2's fix as minimal, raised one follow-up on R1-F1's
fix, and stated a position on all three self-declared points.

| # | Sev | Finding | Disposition |
|---|---|---|---|
| R2-F1 | P3 | `AdminMobileNav.tsx:50` — missed-state race: if the query becomes matching after the opener click but before the passive effect subscribes, `mq` is constructed with `matches === true` and no later `change` event is guaranteed. | **accept** — correct in principle. Effects run after paint and a `change` fired in that gap is not replayed, so subscribing without reading the current value can miss the state entirely. The window is very narrow in practice (it needs a resize across `64rem` inside one frame of the burger tap, and the burger is itself `lg:hidden`), but the guard is a single `onChange()` call before `addEventListener` and costs nothing. Fixed in `7328b8b`. |

Self-declared points, reviewer positions:

| # | Reviewer | Note |
|---|---|---|
| F0 | **agree** | `Dialog.tsx` hardcodes centred/modal layout and content behaviour; adding variants would be a larger, less focused change than a drawer-local native element. |
| F0b | **agree** | Do not add DOM test infrastructure or extract `isActive` merely to manufacture a test; neither would exercise the `<dialog>` lifecycle that actually matters here. |
| F0c | **agree** | The desktop `aria-current` omission predates this diff, and `docs/02-storefront.md:22` governs `StoreHeader`, not admin. Track separately rather than expanding this mobile fix. |

## Local CI after the round-2 fix — head `7328b8b`

| Step | Result |
|---|---|
| `yarn install --frozen-lockfile` | success |
| `yarn test` | 56 files, **267 passed** |
| `yarn build` | compiled in 2.3s, TypeScript clean |

## Known gap, deliberately not closed here

The desktop sidebar (`app/(admin)/admin/layout.tsx:47-55`) still renders every
`ADMIN_NAV` link identically with no `aria-current`. Both agents agreed this
predates the diff and belongs to its own change.

## Round 3 — agreement

**Parent (Claude Code):** R2-F1 accepted and fixed in `7328b8b`; F0/F0b/F0c
positions recorded, F0c carried forward as a known gap rather than dropped.
Local CI green at `7328b8b`. No open findings from my side.
**`AGREEMENT: ready`**

**Reviewer (Codex, gpt-5.6-sol, high, read-only):** *"`AdminMobileNav.tsx:50` —
verified: the immediate `onChange()` closes an already-matching query,
synchronous listener attachment leaves no interleavable gap, and cleanup remains
scoped to `open`. No further material defects or doctrine drift found in
`57d2d2f..7328b8b`; F0/F0b/F0c dispositions remain agreed."*
**`AGREEMENT: ready`**

Reached in 3 of the 4 permitted rounds.

## Contribution counts

| Side | Messages |
|---|---|
| Parent (Claude Code) | 3 |
| Reviewer (Codex) | 3 |
