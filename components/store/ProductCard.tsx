"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import type { Doc } from "@/convex/_generated/dataModel";

type BookWithCover = Doc<"books"> & { coverUrl?: string | null };
import { bookFormats } from "@/lib/formats";
import { Price } from "@/components/store/Price";
import { useDict } from "@/app/I18nProvider";

export function ProductCard({ book, categoryTitle }: { book: BookWithCover; categoryTitle?: string }) {
  const dict = useDict();
  return (
    <Link href={`/book/${book.slug}`} className="group block">
      <Card className="h-full transition hover:-translate-y-0.5 hover:shadow-card">
        {categoryTitle ? (
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-primary">{categoryTitle}</p>
        ) : null}
        <div
          className="relative aspect-[2/3] overflow-hidden rounded-3xl text-white"
          style={{ backgroundImage: book.coverUrl ? undefined : `linear-gradient(140deg, ${book.gradientFrom ?? "#147a5c"}, ${book.gradientTo ?? "#2f7dbd"})` }}
        >
          {book.coverUrl ? (
            <img src={book.coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]" />
          ) : (
            <>
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/10" />
              <div className="relative z-10 flex h-full flex-col justify-end p-5">
                <h3 className="text-2xl font-semibold">{book.title}</h3>
                <p className="mt-2 text-sm text-white/80">{book.author}</p>
              </div>
            </>
          )}
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Badge variant="success">{book.ageGroup}</Badge>
          {bookFormats(book).map((format) => (
            <Badge key={format}>{format}</Badge>
          ))}
        </div>
        <p className="mt-4 text-sm text-muted">{book.blurb}</p>
        <div className="mt-5 flex items-center justify-between">
          <Price cents={book.priceCents} className="text-sm font-semibold text-primary" />
          <span className="text-sm font-semibold text-ink">{dict.product.viewGuide} →</span>
        </div>
      </Card>
    </Link>
  );
}
