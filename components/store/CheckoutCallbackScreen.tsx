"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAction, useConvexAuth, useQuery } from "convex/react";
import { Container } from "@/components/ui/Container";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { api } from "@/convex/_generated/api";
import { useDict } from "@/app/I18nProvider";

/**
 * Where Paystack's hosted checkout returns the shopper.
 *
 * This screen grants nothing — it only reports what the webhook has already
 * recorded. `orderStatus` is a live Convex query, so the moment the webhook
 * flips the order to paid this re-renders on its own; no polling loop.
 *
 * It also asks Paystack directly, once, on mount. The browser frequently beats
 * the webhook home, and a webhook can be dropped outright — without that call
 * a customer who has genuinely paid would sit on a spinner forever.
 */
export function CheckoutCallbackScreen() {
  const dict = useDict();
  const router = useRouter();
  const reference = useSearchParams().get("reference") ?? "";
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();

  const order = useQuery(
    api.payments.orderStatus,
    isAuthenticated && reference ? { reference } : "skip",
  );
  const syncFromGateway = useAction(api.payments.syncFromGateway);

  useEffect(() => {
    if (!isAuthenticated || !reference) return;
    // Fire and forget: reconcile is idempotent, so racing the webhook is safe,
    // and a failure here just means we keep waiting on the live query.
    void syncFromGateway({ reference }).catch(() => {});
  }, [isAuthenticated, reference, syncFromGateway]);

  useEffect(() => {
    if (order?.status === "paid" && order.bookSlug) {
      router.replace(`/read/${order.bookSlug}`);
    }
  }, [order, router]);

  if (authLoading) return null;

  const body =
    !reference || order === null
      ? dict.checkout.notFound
      : order === undefined || order.status === "pending"
        ? dict.checkout.pendingBody
        : order.status === "paid"
          ? dict.checkout.paidBody
          : dict.checkout.refundedBody;

  return (
    <Container>
      <SectionHeader eyebrow={dict.checkout.eyebrow} title={dict.checkout.title} body={body} />
      <div className="mt-8 flex gap-4 text-sm">
        <Link href="/library" className="font-semibold text-primary hover:underline">
          {dict.checkout.goToLibrary}
        </Link>
        <Link href="/store" className="text-muted hover:underline">
          {dict.product.backToStore}
        </Link>
      </div>
    </Container>
  );
}
