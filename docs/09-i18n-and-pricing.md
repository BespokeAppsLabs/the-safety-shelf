# The Safety Shelf — Localization & Pricing

Implemented 2026-07-30. Covers how the storefront picks a language, and how one
catalogue price is shown in each market's currency.

Two separate concerns that share a request: **which language a shopper reads**
and **which currency they are quoted**. They are resolved on different axes and
must not be collapsed — see [Why language ≠ currency](#why-language--currency).

---

## Language

### Detection

`proxy.ts` resolves the language on every request and pins it to a cookie. No
redirect, no `/[lang]/` URL segment — one URL per page.

| Order | Source | Why |
|---|---|---|
| 1 | `locale` cookie | An explicit choice the shopper already made. Always wins. |
| 2 | `Accept-Language` header | What their browser says they actually read. |
| 3 | `x-vercel-ip-country` | Vercel resolves client IP → country at the edge. No geo-IP dependency. |
| 4 | `en` | Default. |

**Accept-Language deliberately outranks geography.** Region is a poor proxy for
language in this store's markets: an English speaker in Dubai, an expat in
Mumbai, and a Malaysian who reads English are all served wrongly by a geo-first
chain. Geography only breaks ties the browser left open. `test/locale.test.ts`
pins this case.

Because the cookie is set before render, the first paint is already translated —
there is no flash of English.

### Dictionaries

`lib/dictionaries/<lang>.json`, one file per language in `LANGUAGES`
(`lib/languages.ts`). English is the source; `lib/i18n.ts` overlays a
translation on it, so a key a translator has not reached — or one added after
the translations were generated — falls through to readable English rather than
a blank or a raw key path.

Components read the dictionary as a **typed object** (`dict.product.viewGuide`),
not a `t("product.viewGuide")` string lookup, so TypeScript catches a renamed or
deleted key at build time instead of rendering the key path to a customer.

- Server components: `getServerI18n()` (`lib/i18n.server.ts`) — they sit inside
  the provider but cannot read React context.
- Client components: `useDict()` / `useI18n()` (`app/I18nProvider.tsx`).
- Interpolation: `fill(dict.product.buyFor, { price })`. Prices go **through**
  the placeholder, never concatenated around it — word order differs per
  language.

`test/dictionaries.test.ts` asserts every dictionary matches English's key
structure exactly and preserves every `{placeholder}`. It has already caught a
dropped `{count}` in Arabic.

### Scope

**The storefront, landing, reader and library are translated. Admin is not** —
it is owner-only, single-operator, and ~2,300 lines. Translating it buys
nothing.

### RTL

Arabic sets `dir="rtl"` on `<html>` from the root layout. Cheap here: the
codebase contains only a handful of directional Tailwind classes.

### Fonts

Geist ships Latin and Latin-ext only. Greek, Arabic, Devanagari, Hangul and Kana
have **no Geist glyphs** — `app/globals.css` carries a system-font fallback
chain for those scripts rather than pulling five more Noto families over the
wire. Without it those markets render tofu boxes.

---

## Pricing

### Nothing is hardcoded

The old `lib/money.ts` returned `` `$${cents/100}` `` and is deleted. Every
input to a displayed price now comes from the database:

| Value | Source |
|---|---|
| Amount | `books.priceCents` |
| What that amount is denominated in | `storeSettings.baseCurrency` (singleton) |
| Display rate | `fxRates` (owner-managed, Admin → Settings) |
| Currency decimals | `Intl` ISO data — **not** a lookup table |

The owner prices each book **once**, in the base currency (USD, ZAR, anything).
Everything else is derived.

### The calculator

`lib/pricing.ts` is the only path from `priceCents` to text.

- `minorUnitsPerMajor(currency)` reads `maximumFractionDigits` from
  `Intl.NumberFormat`. A hand-maintained table silently prices JPY 100× wrong
  the day it drifts; JPY/KRW have 0 decimals, USD/EUR/ZAR have 2.
- `convertToWholeUnits()` rounds to the **nearest whole unit — no cents, ever**,
  and never returns 0: a rate that rounded a real price down to nothing would
  put a paid guide in the window at "free".
- `formatWholeUnits()` sets `maximumFractionDigits: 0`, which is what makes "no
  cents" true in the rendered string as well as in the arithmetic.

### Two display components

| Component | Currency shown | Used by |
|---|---|---|
| `<Price>` / `usePriceText` | The **shopper's** currency | Storefront, landing, reader |
| `<BasePrice>` / `useBasePriceFormatter` | The **store's** base currency | All admin surfaces |

Admin must not convert. A South African owner pricing in USD would otherwise see
the catalogue silently rendered in rand while typing dollar amounts, and revenue
is banked in base currency regardless of who is looking at it.

### The ledger never moves

`orders.totalCents` and `orderItems.priceCents` stay in **base-currency minor
units**. Editing a display rate changes shop-window prices and never rewrites
what past customers were charged.

### Unset base currency fails visibly

With no `storeSettings` row the storefront shows "Price unavailable" and
**disables buying**. Guessing a currency would misquote a real shopper, so this
state is deliberate rather than defaulted — Admin → Settings is a required
setup step.

---

## Why language ≠ currency

Arabic alone covers Egypt (EGP), Lebanon (LBP), Saudi Arabia (SAR) and the UAE
(AED): **one dictionary, four currencies.** Spanish spans several more. So
`lib/languages.ts` keeps two independent tables — `COUNTRY_LANGUAGE` and
`COUNTRY_CURRENCY` — and `proxy.ts` writes two cookies, `locale` and `currency`.
Deriving currency from language would price a Cairo shopper in dirhams.

This is ISO reference data, not configuration. What a shopper is *charged* still
comes only from the database.

---

## Admin surfaces

- **Settings → Pricing & currency** (`CurrencyPanel`): set the base currency;
  add/remove per-currency rates. Each rate row previews what a shopper actually
  sees.
- **Book editor**: a live conversion strip under the price field
  (`PriceInOtherCurrencies`) shows every configured market's price as you type.
  Both use the same calculator as the storefront, so a preview cannot drift from
  what shoppers are quoted.

---

## Not yet reader-facing

Book **content** translation (`bookVariants` / `variantBlocks`, see
[05-data-model](05-data-model.md)) remains **admin-only**:
`bookVariants.list` requires owner, and `status` is never flipped to `"live"`.
A Greek shopper currently gets translated chrome wrapping English book text.

Wiring it up needs: a public saved-variants query, `status → "live"` on owner
save, a reader language picker sourced from it, and a fallback notice when a
book has no variant in the shopper's language.

---

## Related

- [02-storefront](02-storefront.md) — pages and purchase flow
- [05-data-model](05-data-model.md) — `storeSettings`, `fxRates`, `bookVariants`
