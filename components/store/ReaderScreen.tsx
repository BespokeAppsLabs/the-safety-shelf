"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { SignInButton } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { useDict } from "@/app/I18nProvider";

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
  const dict = useDict();
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const isOwned = useQuery(api.entitlements.isOwned, isAuthenticated ? { bookId: book._id } : "skip");
  const blocks = useQuery(api.bookBlocks.listByBook, isOwned ? { bookId: book._id } : "skip");

  if (authLoading) return null;

  if (!isAuthenticated) {
    return (
      <LockedCard
        title={dict.reader.signInTitle}
        body={dict.reader.signInBody}
        action={
          <SignInButton mode="modal">
            <button className="inline-flex rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primary-strong">
              {dict.auth.signIn}
            </button>
          </SignInButton>
        }
      />
    );
  }

  if (isOwned === false) {
    return (
      <LockedCard
        title={dict.reader.notOwnedTitle}
        body={dict.reader.notOwnedBody}
        action={
          <Link href={`/book/${book.slug}`} className="inline-flex rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primary-strong">
            {dict.reader.viewGuide}
          </Link>
        }
      />
    );
  }

  if (isOwned === undefined || blocks === undefined) {
    return (
      <Container className="max-w-4xl">
        <p className="py-20 text-center text-sm text-muted">{dict.reader.loading}</p>
      </Container>
    );
  }

  return (
    <Container className="max-w-4xl print:max-w-none print:px-0">
      <div className="mb-6 flex items-center justify-between gap-4 print:hidden">
        <Link href="/library" className="text-sm font-semibold text-primary">← {dict.reader.backToLibrary}</Link>
        <div className="flex min-w-0 items-center gap-4">
          <p className="truncate text-sm text-muted">{book.title} · {book.author}</p>
          {/* ponytail: the browser's own "Save as PDF" is the generator — no
              server render, no stored file. Swap for a generated + stored PDF
              (books.pdfStorageId) when downloads need to be emailed or re-served. */}
          <Button size="sm" variant="ghost" onClick={() => window.print()}>{dict.reader.downloadPdf}</Button>
        </div>
      </div>
      <Card className="book-print space-y-5">
        <section className="book-print-cover hidden print:flex">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">{dict.brand.name}</p>
          <h1 className="text-5xl font-semibold tracking-tight text-ink">{book.title}</h1>
          <p className="text-lg text-muted">{book.author}</p>
        </section>
        <h1 className="text-4xl font-semibold tracking-tight text-ink print:hidden">{book.title}</h1>
        {blocks.map((block) =>
          block.type === "h" ? (
            <h2 key={block._id} className="pt-4 text-2xl font-semibold text-ink">{block.text}</h2>
          ) : block.type === "img" && block.imageUrl ? (
            <img key={block._id} src={block.imageUrl} alt="" className="aspect-square w-full rounded-3xl object-cover" />
          ) : block.type === "p" ? (
            <p key={block._id} className="text-base leading-8 text-muted">{block.text}</p>
          ) : null,
        )}
        <p className="pt-6 text-center text-sm italic text-muted">{dict.reader.endOfGuide}</p>
      </Card>
    </Container>
  );
}
