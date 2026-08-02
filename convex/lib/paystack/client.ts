// ============================================
// PAYSTACK REST CLIENT
// Thin wrapper over the Paystack API. Runs inside Convex actions on the
// default runtime — `fetch` and Web Crypto are available, so no "use node".
//
// The secret key is read from the Convex DEPLOYMENT env, never .env.local —
// same convention as convex/lib/secrets.ts and convex/lib/openrouter.ts:
//   npx convex env set PAYSTACK_SECRET_KEY <key>
//
// Ported from the Malume/2Cool implementation, trimmed to the two calls this
// store makes. Subaccount creation, bank lookup and identity validation are
// deliberately absent: our 45/55 split is a split group created once in the
// Paystack dashboard and referenced by PAYSTACK_SPLIT_CODE, so there is no
// self-serve onboarding to support. See docs/10-payments.md.
// ============================================

const PAYSTACK_BASE = "https://api.paystack.co";

function secretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) {
    throw new Error(
      "PAYSTACK_SECRET_KEY is not set on the Convex deployment. Run: npx convex env set PAYSTACK_SECRET_KEY <key>",
    );
  }
  return key;
}

/**
 * True when this deployment is transacting with real money.
 *
 * Used to scope guards that protect revenue rather than correctness: on a test
 * key nothing settles, so a missing split cannot shortchange anyone.
 */
export function isLiveMode(): boolean {
  return (process.env.PAYSTACK_SECRET_KEY ?? "").startsWith("sk_live_");
}

export type PaystackEnvelope<T> = {
  status: boolean;
  message: string;
  data: T;
};

export type InitializeData = {
  authorization_url: string;
  access_code: string;
  reference: string;
};

export type TransactionData = {
  id?: number;
  /** 'success' | 'failed' | 'abandoned' | ... — read from `data`, NOT the envelope's top-level `status`. */
  status: string;
  reference: string;
  amount: number;
  currency?: string;
  channel?: string;
  gateway_response?: string;
  metadata?: unknown;
};

/**
 * Error carrying the HTTP status so callers can tell a transient transport
 * failure (worth retrying) from a permanent gateway error (a real decline).
 * `status` is 0 for a transport-level failure with no HTTP response.
 */
export class PaystackError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "PaystackError";
    this.status = status;
  }
}

async function call<T>(
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<PaystackEnvelope<T>> {
  let res: Response;
  try {
    res = await fetch(`${PAYSTACK_BASE}${path}`, {
      method: init?.method ?? "GET",
      headers: {
        Authorization: `Bearer ${secretKey()}`,
        "Content-Type": "application/json",
      },
      body: init?.body != null ? JSON.stringify(init.body) : undefined,
    });
  } catch (e) {
    // No HTTP response (network/DNS/timeout) — transport error, status 0.
    throw new PaystackError(
      `Paystack ${path} request failed: ${e instanceof Error ? e.message : String(e)}`,
      0,
    );
  }

  let json: PaystackEnvelope<T> | null | undefined;
  try {
    json = (await res.json()) as PaystackEnvelope<T>;
  } catch {
    throw new PaystackError(`Paystack ${path} returned non-JSON (HTTP ${res.status})`, res.status);
  }

  if (!res.ok || !json?.status) {
    throw new PaystackError(
      `Paystack ${path} failed: HTTP ${res.status} — ${json?.message ?? "unknown error"}`,
      res.status,
    );
  }
  return json;
}

/**
 * POST /transaction/initialize — start a hosted checkout, returns the
 * authorization_url we redirect the shopper to.
 *
 * `amount` is minor units of `currency`, which is always the store's
 * baseCurrency: books.priceCents is passed through verbatim. There is no
 * default currency here on purpose — a hardcoded fallback is exactly how a
 * store silently charges the wrong money.
 *
 * `split_code` applies the 45/55 revenue split. It is the split group's code,
 * not a subaccount code: only a split group can share Paystack's fee
 * proportionally between the two parties (bearer_type "all-proportional"),
 * which is what "45/55 after platform deductions" actually means. A bare
 * `subaccount` + `bearer` pair cannot express it — `bearer: 'account'` makes
 * the main account absorb the entire fee out of its share.
 */
export function initializeTransaction(body: {
  email: string;
  amount: number;
  currency: string;
  reference: string;
  callback_url?: string;
  split_code?: string;
  metadata?: unknown;
}) {
  return call<InitializeData>("/transaction/initialize", { method: "POST", body });
}

/**
 * GET /transaction/verify/:reference — authoritative status of a transaction.
 * Used by the callback page to settle the race where the shopper's browser
 * returns before Paystack's webhook lands.
 */
export function verifyTransaction(reference: string) {
  return call<TransactionData>(`/transaction/verify/${encodeURIComponent(reference)}`);
}
