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
  const reference = data.reference;
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
    case "charge.failed":
      await ctx.runMutation(internal.payments.reconcile, {
        reference,
        outcome: "failed",
        failureReason: data.gateway_response ?? event.event,
      });
      break;
    case "charge.refunded":
    case "refund.processed":
      await ctx.runMutation(internal.payments.refund, { reference });
      break;
    default:
      break; // events we do not act on
  }

  return new Response("ok", { status: 200 });
});

http.route({ path: "/paystack/webhook", method: "POST", handler: paystackWebhook });

export default http;
