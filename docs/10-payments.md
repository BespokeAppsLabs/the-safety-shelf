# 10 — Payments (Paystack)

Checkout runs on Paystack hosted payment pages. Revenue is split **55/45**:
Bespoke's main account keeps 55%, the client's subaccount receives 45%, and
Paystack's gateway fee is shared between them in the same proportion.

## Why a split group, not a subaccount

Paystack offers two ways to split money, and only one expresses "45/55 after
fees":

| | `subaccount` + `percentage_charge` | **Split group (`split_code`)** |
|---|---|---|
| Fee handling | `bearer` picks ONE party to pay the whole fee | `bearer_type: "all-proportional"` shares it |
| Result | main account absorbs 100% of the fee out of its 55 | both parties net down proportionally |

We use a split group. Setting `bearer: 'account'` on a bare subaccount would
quietly shift the entire gateway cost onto Bespoke, which is not the deal.

```
gross            ZAR 150.00
- paystack fee   ZAR   4.50   ← shared proportionally
= net            ZAR 145.50
  → main (Bespoke)  55%   ZAR 80.03
  → sub  (client)   45%   ZAR 65.47
```

The split lives entirely in the Paystack dashboard. The app knows one opaque
string, `PAYSTACK_SPLIT_CODE`, and never computes a share — so changing the
ratio is a dashboard edit, not a deploy.

## Merchant of record

Bespoke holds the main account, which makes **Bespoke the merchant of record**:
Bespoke holds the Paystack contract, owns the customer relationship, and carries
chargeback liability. Refunds are debited from Bespoke's account. The client's
45% settles to their own bank on Paystack's normal schedule.

## What gets charged

The shopper is charged `books.priceCents` in `storeSettings.baseCurrency`,
verbatim. The localised price shown around the store is **display only** — see
`09-i18n-and-pricing.md`. Their card issuer performs any conversion.

This keeps the rule that the ledger never moves: `orders.totalCents` and
`orderItems.priceCents` are base-currency minor units, and `orders.currency`
snapshots which currency that was, so a later change of base currency cannot
re-denominate historical revenue.

**The base currency must be one the Paystack account is enabled for.** A ZA
account takes ZAR. If it is not, `startCheckout` surfaces Paystack's own
"currency not supported" message rather than failing silently.

## The flow

```
BuyButton
  └─ payments.startCheckout (action)
       ├─ payments.createPendingOrder   → orders(status:"pending") + orderItems
       └─ Paystack /transaction/initialize (amount, currency, split_code)
            → redirect to Paystack hosted page
                 ├─ webhook  POST convex.site/paystack/webhook  → payments.reconcile   ← grants access
                 └─ browser  APP_URL/payments/callback          → payments.syncFromGateway (verify + same reconcile)
```

Rules the code enforces:

- **Only `payments.reconcile` grants a paid entitlement.** Nothing else may.
- **The webhook is authoritative.** The callback page reports; it never grants.
- **Idempotent.** Paystack retries webhooks, and the callback can race one.
  Reconcile returns early once an order is `paid` or `refunded`, so a replay
  cannot issue a second entitlement or double the revenue.
- **Amount and currency are re-checked** against what we recorded at initiation
  before access is granted, even though the webhook is signed. A mismatch is
  recorded in `orders.failureReason` and grants nothing.
- **Signature verified over the raw body** (HMAC-SHA512, constant-time compare)
  before the payload is parsed. Missing secret or header fails closed.
- Abandoned checkouts leave `pending` orders. They are inert: every sales figure
  routes through `convex/lib/sales.ts` → `paidOrderItems`, and ownership is
  checked against `entitlements`, so a stale pending row neither counts as
  revenue nor blocks a retry.

## Setup

One-time, in the Paystack dashboard (Bespoke's account):

1. **Subaccount** — the client's bank details. ZA validates via `/bank/validate`;
   `/bank/resolve` is Nigeria/Ghana only. Note that `is_verified: false` on the
   response is Paystack's own KYC state, not a failure — the subaccount works.
2. **Split group** — type `percentage`, currency `ZAR`, one subaccount at share
   `45` (the main account keeps the remaining 55), bearer `all-proportional`.
   Copy the `SPL_...` code.
3. **Webhook** — `https://<deployment>.convex.site/paystack/webhook`.
4. **Base currency** — set it in Admin → Settings to match the account (`ZAR`).

Then, per deployment:

```bash
npx convex env set PAYSTACK_SECRET_KEY sk_test_...   # sk_live_ in production
npx convex env set PAYSTACK_SPLIT_CODE SPL_...
npx convex env set APP_URL http://localhost:5050     # the real origin in production
```

## Testing

Paystack test cards (full matrix in the wiki's Paystack page):

| Card | CVV | Outcome |
|---|---|---|
| 4084 0840 8408 4081 | 408 | success, reusable |
| 4084 0800 0000 5408 | 001 | declined |

Replay a webhook from the Paystack dashboard to confirm no duplicate grant.
`convex/payments/tests/reconcile.test.ts` covers the same rules offline.
