"use client";

import { useState } from "react";
import Link from "next/link";
import { SignInButton } from "@clerk/nextjs";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { Button } from "@/components/ui/Button";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { usePriceText } from "@/components/store/Price";
import { useDict } from "@/app/I18nProvider";
import { fill } from "@/lib/i18n";

export function BuyButton({ book }: { book: Doc<"books"> }) {
  const dict = useDict();
  const price = usePriceText(book.priceCents);
  const { isAuthenticated } = useConvexAuth();
  const isOwned = useQuery(api.entitlements.isOwned, isAuthenticated ? { bookId: book._id } : "skip");
  const demoPurchase = useMutation(api.entitlements.demoPurchase);
  const [busy, setBusy] = useState(false);

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
    <Button
      disabled={busy || isOwned === undefined || price === null}
      variant="secondary"
      onClick={async () => {
        setBusy(true);
        try {
          await demoPurchase({ bookId: book._id });
        } finally {
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
  );
}
