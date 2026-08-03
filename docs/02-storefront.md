# The Safety Shelf — Storefront

Digital-only. A reader browses, buys, reads online or downloads, and owns a
personal library of purchases.

## Pages
| Route | Purpose |
|---|---|
| `/` | Marketing landing — hero, shelves, featured books (its own header) |
| `/store` | Catalog grid — cover, title, author, price, language badges |
| `/book/[slug]` | Detail — blurb, sample, price, available languages, Buy button |
| `/read/[slug]` | In-browser reader (block-based content, honors purchase) |
| `/library` | **My Library** — the signed-in reader's purchased books |

There is no `/account` route. Profile and **sign out** live in Clerk's
`<UserButton />` in the header — the same component the admin topbar uses.
Sign-out lands on `/` via `afterSignOutUrl` on `ClerkProvider`; without it,
signing out from a protected page leaves the user on it and gets bounced to
sign-in, which reads as a failed logout. In Clerk 7 that is a provider option,
not a `UserButton` prop.

## Header navigation
`StoreHeader` marks the current page with the same filled-primary pill the
storefront's category chips use for the active chip, plus `aria-current="page"`.
Before that, every nav item rendered identically and only Library carried a
background and shadow — so Library read as "selected" on every page and the
actual page was unmarked.

`/` matches only itself. `/book/*` counts as **Store** (browsing) and `/read/*`
counts as **Library** (reading what you own), so neither of those pages
highlights nothing.

## Customer accounts (simple)
- Auth via **Clerk** (email + social login). One role: `customer`.
- Purchase writes an `entitlements` doc `(userId, bookId, grantedAt)`.
- **My Library** = Convex query over `entitlements` + `books` for the signed-in user.
- Access control: `/read/[slug]` and downloads check the entitlement. No entitlement → sample only.

## Purchase flow (production)
**Built — see [10-payments](10-payments.md) for the split and the setup.**

1. Buy → `payments.startCheckout` reserves a `pending` order, then redirects to
   **Paystack hosted checkout** (no PCI burden). Charged in the store's base
   currency; the localised price is display only.
2. `charge.success` webhook → Convex `httpAction` at `/paystack/webhook` →
   `payments.reconcile` flips the order to `paid` and writes `entitlements`.
   This is the only path that grants access; it is idempotent and re-checks the
   amount and currency before granting.
3. Paystack returns the shopper to `/payments/callback`, which reports status
   from a live query (and verifies against Paystack once, in case the browser
   beat the webhook home) then sends them into the reader.

## Localization & pricing
**Built 2026-07-30 — see [09-i18n-and-pricing](09-i18n-and-pricing.md) for the full design.**

- **UI**: 21 languages. `proxy.ts` picks one per request — `locale` cookie →
  `Accept-Language` → Vercel's `x-vercel-ip-country` → `en` — and pins it to a
  cookie, so the first paint is already translated. No redirect, no `/[lang]/`
  segment. A picker in the store header overrides it permanently. Arabic renders
  RTL.
- **Price**: the owner prices each book once in `storeSettings.baseCurrency`;
  shoppers see their country's currency via owner-managed `fxRates`, rounded to
  a whole unit with **no cents**. Orders are still recorded in base-currency
  minor units.
- **Book content**: reader-facing variant serving is **not wired yet** —
  `bookVariants` remains admin-only, so translated chrome currently wraps
  original-language book text. See [05-data-model](05-data-model.md).

## Demo build (storefront only — no admin)
Purpose: a browsable, real-looking store to show the owner. **No DB, no payments,
no real auth.**
- Seed ~6 books as a local TS array; covers as CSS gradients (no external assets).
- "Buy" simulates checkout and writes the purchase to `localStorage`.
- **My Library** reads from `localStorage` — demonstrates the owned-books flow end to end.
- `/read/[slug]` renders seed chapter text for owned books.

> Swap points for production: `localStorage` → `entitlements` table; mock buy → Paystack checkout; local seed → DB. Nothing else changes in the UI.
