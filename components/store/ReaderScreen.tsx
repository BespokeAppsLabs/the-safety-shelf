"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { SignInButton } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";

function LockedCard({ title, body, action }: { title: string; body: string; action: ReactNode }) {
  return (
    <Container className="max-w-3xl">
      <Card className="mx-auto mt-12 max-w-xl text-center">
        <p className="text-4xl">🔒</p>
        <h1 className="mt-4 text-2xl font-semibold text-ink">{title}</h1>
        <p className="mt-2 text-sm text-muted">{body}</p>
        <div className="mt-6">{action}</div>
      </Card>
    </Container>
  );
}

export function ReaderScreen({ book }: { book: Doc<"books"> }) {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const isOwned = useQuery(api.entitlements.isOwned, isAuthenticated ? { bookId: book._id } : "skip");
  const blocks = useQuery(api.bookBlocks.listByBook, isOwned ? { bookId: book._id } : "skip");

  if (authLoading) return null;

  if (!isAuthenticated) {
    return (
      <LockedCard
        title="Sign in to read this guide."
        body="Your purchased guides are tied to your account."
        action={
          <SignInButton mode="modal">
            <button className="inline-flex rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primary-strong">
              Sign in
            </button>
          </SignInButton>
        }
      />
    );
  }

  if (isOwned === false) {
    return (
      <LockedCard
        title="You do not own this guide yet."
        body="Buy the guide first to unlock the full reader."
        action={
          <Link href={`/book/${book.slug}`} className="inline-flex rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primary-strong">
            View guide
          </Link>
        }
      />
    );
  }

  if (isOwned === undefined || blocks === undefined) {
    return (
      <Container className="max-w-4xl">
        <p className="py-20 text-center text-sm text-muted">Loading guide…</p>
      </Container>
    );
  }

  return (
    <Container className="max-w-4xl">
      <div className="mb-6 flex items-center justify-between gap-4">
        <Link href="/library" className="text-sm font-semibold text-primary">← Library</Link>
        <p className="truncate text-sm text-muted">{book.title} · {book.author}</p>
      </div>
      <Card className="space-y-5">
        <h1 className="text-4xl font-semibold tracking-tight text-ink">{book.title}</h1>
        {blocks.map((block) =>
          block.type === "h" ? (
            <h2 key={block._id} className="pt-4 text-2xl font-semibold text-ink">{block.text}</h2>
          ) : block.type === "img" && block.imageUrl ? (
            <img key={block._id} src={block.imageUrl} alt="" className="aspect-square w-full rounded-3xl object-cover" />
          ) : block.type === "p" ? (
            <p key={block._id} className="text-base leading-8 text-muted">{block.text}</p>
          ) : null,
        )}
        <p className="pt-6 text-center text-sm italic text-muted">— end of guide —</p>
      </Card>
    </Container>
  );
}
