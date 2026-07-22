"use client";

import { useState } from "react";
import Link from "next/link";
import { SignInButton } from "@clerk/nextjs";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { Button } from "@/components/ui/Button";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { formatPrice } from "@/lib/money";

export function BuyButton({ book }: { book: Doc<"books"> }) {
  const { isAuthenticated } = useConvexAuth();
  const isOwned = useQuery(api.entitlements.isOwned, isAuthenticated ? { bookId: book._id } : "skip");
  const demoPurchase = useMutation(api.entitlements.demoPurchase);
  const [busy, setBusy] = useState(false);

  if (!isAuthenticated) {
    return (
      <SignInButton mode="modal">
        <Button variant="secondary">Sign in to buy for {formatPrice(book.priceCents)}</Button>
      </SignInButton>
    );
  }

  if (isOwned) {
    return (
      <Link
        href={`/read/${book.slug}`}
        className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primary-strong"
      >
        Read guide
      </Link>
    );
  }

  return (
    <Button
      disabled={busy || isOwned === undefined}
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
      {busy ? "Processing..." : `Buy for ${formatPrice(book.priceCents)}`}
    </Button>
  );
}
