"use client";

import { useState } from "react";
import Link from "next/link";
import { SignInButton } from "@clerk/nextjs";
import { useConvexAuth, useAction, useQuery } from "convex/react";
import { Button } from "@/components/ui/Button";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { usePriceText, useExactBillingText } from "@/components/store/Price";
import { useDict } from "@/app/I18nProvider";
import { fill } from "@/lib/i18n";

export function BuyButton({ book }: { book: Doc<"books"> }) {
  const dict = useDict();
  const price = usePriceText(book.priceCents);
  const billedAs = useExactBillingText(book.priceCents);
  const { isAuthenticated } = useConvexAuth();
  const isOwned = useQuery(api.entitlements.isOwned, isAuthenticated ? { bookId: book._id } : "skip");
  const startCheckout = useAction(api.payments.startCheckout);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isAuthenticated) {
    return (
      <SignInButton mode="modal">
        <Button variant="secondary">
          {price ? fill(dict.product.signInToBuy, { price }) : dict.auth.signIn}
        </Button>
      </SignInButton>
    );
  }

  if (isOwned) {
    return (
      <Link
        href={`/read/${book.slug}`}
        className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primary-strong"
      >
        {dict.product.readGuide}
      </Link>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        disabled={busy || isOwned === undefined || price === null}
        variant="secondary"
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            const result = await startCheckout({ bookId: book._id });
            if ("alreadyPaid" in result) {
              // Verification found this checkout had already settled — the
              // webhook was late or lost. They own it; send them to the reader.
              window.location.href = `/read/${book.slug}`;
              return;
            }
            // Leaving the app for Paystack's hosted page — stay in the busy
            // state through the redirect so the button cannot be double-fired.
            window.location.href = result.authorizationUrl;
          } catch (e) {
            // A failure here means checkout never opened, so there is nothing
            // to reconcile — just tell the shopper instead of silently
            // resetting the button and looking like the click was ignored.
            setError(e instanceof Error ? e.message : dict.product.priceUnavailable);
            setBusy(false);
          }
        }}
      >
        {busy
          ? dict.product.processing
          : price
            ? fill(dict.product.buyFor, { price })
            : dict.product.priceUnavailable}
      </Button>
      {/* The store price is a converted, rounded approximation; this is the
          figure that will appear on their statement. Shown before they commit,
          not after. */}
      {billedAs ? (
        <p className="text-xs text-muted">{fill(dict.product.billedAs, { amount: billedAs })}</p>
      ) : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
