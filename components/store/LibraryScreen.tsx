"use client";

import Link from "next/link";
import { SignInButton } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProductCard } from "@/components/store/ProductCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Container } from "@/components/ui/Container";
import { api } from "@/convex/_generated/api";
import { useDict } from "@/app/I18nProvider";
import { plural } from "@/lib/i18n";

export function LibraryScreen() {
  const dict = useDict();
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const items = useQuery(api.entitlements.listForUser, isAuthenticated ? {} : "skip");

  if (authLoading) return null;

  if (!isAuthenticated) {
    return (
      <Container>
        <SectionHeader eyebrow={dict.library.eyebrow} title={dict.library.signedOutTitle} body={dict.library.signedOutBody} />
        <div className="mt-8">
          <SignInButton mode="modal">
            <button className="inline-flex rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primary-strong">
              {dict.auth.signIn}
            </button>
          </SignInButton>
        </div>
      </Container>
    );
  }

  if (items === undefined) {
    return (
      <Container>
        <p className="py-20 text-center text-sm text-muted">{dict.library.loading}</p>
      </Container>
    );
  }

  return (
    <Container>
      <SectionHeader
        eyebrow={dict.library.eyebrow}
        title={dict.library.title}
        body={items.length ? plural(items.length, dict.library) : dict.library.emptyBody}
      />
      {items.length ? (
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((book) => (
            <div key={book.slug} className="space-y-3">
              <ProductCard book={book} />
              <Link href={`/read/${book.slug}`} className="inline-flex rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primary-strong">
                {dict.library.continueReading}
              </Link>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-8">
          <EmptyState
            actionHref="/store"
            actionLabel={dict.library.browseStore}
            body={dict.library.emptyStateBody}
            title={dict.library.emptyTitle}
          />
        </div>
      )}
    </Container>
  );
}
