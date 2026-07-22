"use client";

import Link from "next/link";
import { SignInButton } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProductCard } from "@/components/store/ProductCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Container } from "@/components/ui/Container";
import { api } from "@/convex/_generated/api";

export function LibraryScreen() {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const items = useQuery(api.entitlements.listForUser, isAuthenticated ? {} : "skip");

  if (authLoading) return null;

  if (!isAuthenticated) {
    return (
      <Container>
        <SectionHeader eyebrow="My library" title="Sign in to see your library." body="Purchased guides are tied to your account." />
        <div className="mt-8">
          <SignInButton mode="modal">
            <button className="inline-flex rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primary-strong">
              Sign in
            </button>
          </SignInButton>
        </div>
      </Container>
    );
  }

  if (items === undefined) {
    return (
      <Container>
        <p className="py-20 text-center text-sm text-muted">Loading your library…</p>
      </Container>
    );
  }

  return (
    <Container>
      <SectionHeader
        eyebrow="My library"
        title="Your purchased safety guides."
        body={items.length ? `${items.length} guide${items.length === 1 ? "" : "s"} ready to read.` : "Buy a guide once and it stays here."}
      />
      {items.length ? (
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((book) => (
            <div key={book.slug} className="space-y-3">
              <ProductCard book={book} />
              <Link href={`/read/${book.slug}`} className="inline-flex rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primary-strong">
                Continue reading
              </Link>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-8">
          <EmptyState
            actionHref="/store"
            actionLabel="Browse the store"
            body="Your purchased titles will appear here after checkout."
            title="No guides in your library yet."
          />
        </div>
      )}
    </Container>
  );
}
