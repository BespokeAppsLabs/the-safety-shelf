"use client";

import Link from "next/link";
import { AdminBookActions } from "@/components/store/AdminBookActions";
import { BuyButton } from "@/components/store/BuyButton";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import type { Doc } from "@/convex/_generated/dataModel";

type BookWithCover = Doc<"books"> & { coverUrl?: string | null };
type BlockWithImage = Doc<"bookBlocks"> & { imageUrl?: string | null };
import { bookFormats } from "@/lib/formats";
import { Price } from "@/components/store/Price";
import { useDict } from "@/app/I18nProvider";
import { fill } from "@/lib/i18n";

export function ProductDetailScreen({
  book,
  categoryTitle,
  sample,
}: {
  book: BookWithCover;
  categoryTitle: string;
  sample: BlockWithImage[];
}) {
  const dict = useDict();
  return (
    <Container>
      <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <Card className="p-4">
          <div
            className="relative flex min-h-96 flex-col justify-between overflow-hidden rounded-3xl p-6 text-white"
            style={{ backgroundImage: book.coverUrl ? undefined : `linear-gradient(150deg, ${book.gradientFrom ?? "#147a5c"}, ${book.gradientTo ?? "#2f7dbd"})` }}
          >
            {book.coverUrl ? <img src={book.coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover" /> : null}
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-black/10" />
            <p className="relative z-10 text-xs font-semibold uppercase tracking-[0.24em] text-white/80">{categoryTitle}</p>
            <div className="relative z-10">
              <h1 className="text-4xl font-semibold tracking-tight">{book.title}</h1>
              <p className="mt-3 text-base text-white/80">{book.author}</p>
            </div>
          </div>
        </Card>

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="success">{book.ageGroup}</Badge>
            {bookFormats(book).map((format) => (
              <Badge key={format}>{format}</Badge>
            ))}
          </div>
          <h2 className="mt-4 text-4xl font-semibold tracking-tight text-ink">{book.title}</h2>
          <p className="mt-2 text-lg text-muted">{fill(dict.product.by, { author: book.author })}</p>
          <p className="mt-6 max-w-2xl text-base leading-7 text-muted">{book.blurb}</p>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <Price cents={book.priceCents} className="text-3xl font-semibold text-primary" />
            <BuyButton book={book} />
            <AdminBookActions book={book} />
          </div>

          <Card className="mt-8">
            <h3 className="text-lg font-semibold text-ink">{dict.product.guidePreview}</h3>
            <div className="mt-4 space-y-3">
              {sample.map((block) =>
                block.type === "h" ? (
                  <h4 key={block._id} className="text-xl font-semibold text-ink">{block.text}</h4>
                ) : block.type === "img" && block.imageUrl ? (
                  <img key={block._id} src={block.imageUrl} alt="" className="aspect-square w-full rounded-3xl object-cover" />
                ) : block.type === "p" ? (
                  <p key={block._id} className="text-sm leading-7 text-muted">{block.text}</p>
                ) : null,
              )}
            </div>
          </Card>

          <Link href="/store" className="mt-6 inline-flex text-sm font-semibold text-primary">
            ← {dict.product.backToStore}
          </Link>
        </div>
      </div>
    </Container>
  );
}
