import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import type { Doc } from "@/convex/_generated/dataModel";

type BookWithCover = Doc<"books"> & { coverUrl?: string | null };
import { bookFormats } from "@/lib/formats";
import { formatPrice } from "@/lib/money";

export function ProductCard({ book, categoryTitle }: { book: BookWithCover; categoryTitle?: string }) {
  return (
    <Link href={`/book/${book.slug}`} className="block">
      <Card className="h-full transition hover:-translate-y-0.5 hover:shadow-card">
        <div
          className="relative h-56 overflow-hidden rounded-3xl p-5 text-white"
          style={{ backgroundImage: book.coverUrl ? undefined : `linear-gradient(140deg, ${book.gradientFrom ?? "#147a5c"}, ${book.gradientTo ?? "#2f7dbd"})` }}
        >
          {book.coverUrl ? <img src={book.coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover" /> : null}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/10" />
          <div className="relative z-10 flex h-full flex-col justify-between">
            {categoryTitle ? (
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/80">{categoryTitle}</p>
            ) : <span />}
            <div>
              <h3 className="text-2xl font-semibold">{book.title}</h3>
              <p className="mt-2 text-sm text-white/80">{book.author}</p>
            </div>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Badge variant="success">{book.ageGroup}</Badge>
          {bookFormats(book).map((format) => (
            <Badge key={format}>{format}</Badge>
          ))}
        </div>
        <p className="mt-4 text-sm text-muted">{book.blurb}</p>
        <div className="mt-5 flex items-center justify-between">
          <span className="text-sm font-semibold text-primary">{formatPrice(book.priceCents)}</span>
          <span className="text-sm font-semibold text-ink">View guide →</span>
        </div>
      </Card>
    </Link>
  );
}
