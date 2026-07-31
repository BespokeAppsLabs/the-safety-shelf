# The Safety Shelf — Storefront

Digital-only. A reader browses, buys, reads online or downloads, and owns a
personal library of purchases.

## Pages
| Route | Purpose |
|---|---|
| `/` | Catalog grid — cover, title, author, price, language badges |
| `/book/[slug]` | Detail — blurb, sample, price, available languages, Buy button |
| `/read/[slug]` | In-browser reader (block-based content, honors purchase) |
| `/library` | **My Library** — the signed-in reader's purchased books |
| `/account` | Basic profile (name, email, sign out) |

## Customer accounts (simple)
- Auth via **Clerk** (email + social login). One role: `customer`.
- Purchase writes an `entitlements` doc `(userId, bookId, grantedAt)`.
- **My Library** = Convex query over `entitlements` + `books` for the signed-in user.
- Access control: `/read/[slug]` and downloads check the entitlement. No entitlement → sample only.

## Purchase flow (production)
1. Buy → **Stripe Checkout** (hosted; no PCI burden).
2. `checkout.session.completed` webhook → Convex `httpAction` writes `orders` + `entitlements`.
3. Reader lands on `/library` (reactive Convex query); book is now readable/downloadable.

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
Purpose: a browsable, real-looking store to show the owner. **No DB, no Stripe,
no real auth.**
- Seed ~6 books as a local TS array; covers as CSS gradients (no external assets).
- "Buy" simulates checkout and writes the purchase to `localStorage`.
- **My Library** reads from `localStorage` — demonstrates the owned-books flow end to end.
- `/read/[slug]` renders seed chapter text for owned books.

> Swap points for production: `localStorage` → `entitlements` table; mock buy → Stripe Checkout; local seed → DB. Nothing else changes in the UI.
