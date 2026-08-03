import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { verifySignature } from "./lib/paystack/verify";

// ============================================
// HTTP ROUTER — served at https://<deployment>.convex.site
// Convex serves HTTP endpoints ONLY from this file's default export.
// ============================================

const http = httpRouter();

/**
 * Paystack webhook — server-to-server, and the source of truth for payments.
 * Nothing else in the app may grant a paid entitlement.
 *
 * Verifies the HMAC-SHA512 signature over the RAW body, then reconciles.
 * Always answers 200 quickly on anything it recognises so Paystack does not
 * back off; reconcile is idempotent, so a retry is harmless.
 *
 * There is no browser callback route here: the hosted checkout returns
 * straight to the Next.js app (APP_URL/payments/callback), and that page
 * grants nothing.
 */
const paystackWebhook = httpAction(async (ctx, request) => {
  const raw = await request.text();
  const signature = request.headers.get("x-paystack-signature");

  if (!(await verifySignature(raw, signature))) {
    return new Response("Invalid signature", { status: 401 });
  }

  let event: {
    event?: string;
    data?: {
      reference?: string;
      // Refund events key the ORIGINAL transaction differently from charge
      // events — see the reference resolution below.
      transaction_reference?: string;
      transaction?: { reference?: string };
      id?: number | string;
      amount?: number;
      currency?: string;
      gateway_response?: string;
    };
  };
  try {
    event = JSON.parse(raw);
  } catch {
    return new Response("ok", { status: 200 });
  }

  const data = event.data ?? {};
  // charge.* carries `reference`; refund.* carries the original transaction as
  // `transaction_reference` (older payloads nest it under `transaction`).
  // Reading only `reference` silently dropped every refund on the floor.
  const reference = data.reference ?? data.transaction_reference ?? data.transaction?.reference;
  if (!reference) return new Response("ok", { status: 200 });

  switch (event.event) {
    case "charge.success":
      await ctx.runMutation(internal.payments.reconcile, {
        reference,
        outcome: "success",
        amount: data.amount,
        currency: data.currency,
        providerTransactionId: data.id != null ? String(data.id) : undefined,
      });
      break;
    // Defence only, and nothing depends on it: whether Paystack's current event
    // table includes charge.failed is disputed, and an abandoned checkout emits
    // no event at all. Failure is therefore established by verifying the
    // transaction at the next Buy click (payments.startCheckout), never by
    // waiting for a webhook that may not exist. If this one does arrive it
    // records the reason early; if it never does, nothing is stranded.
    case "charge.failed":
      await ctx.runMutation(internal.payments.reconcile, {
        reference,
        outcome: "failed",
        failureReason: data.gateway_response ?? event.event,
      });
      break;
    // Paystack's refund lifecycle is refund.pending -> refund.processed, or
    // refund.failed. There is no `charge.refunded` — that is Stripe's event
    // name, and handling it meant refunds were never processed at all.
    case "refund.processed":
      await ctx.runMutation(internal.payments.refund, { reference });
      break;
    default:
      break; // refund.pending / refund.failed and anything else: no state change
  }

  return new Response("ok", { status: 200 });
});

http.route({ path: "/paystack/webhook", method: "POST", handler: paystackWebhook });

export default http;
