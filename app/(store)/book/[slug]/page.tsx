import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { fetchQuery } from "convex/nextjs";
import { ProductDetailScreen } from "@/components/store/ProductDetailScreen";
import { api } from "@/convex/_generated/api";
import { minorUnitsPerMajor } from "@/lib/pricing";
import { SITE_NAME, SITE_URL } from "@/lib/seo";

// generateMetadata and the page both need the book; cache() makes that one
// Convex round trip instead of two.
const getBook = cache((slug: string) => fetchQuery(api.books.getBySlug, { slug }));

export async function generateMetadata({ params }: PageProps<"/book/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const book = await getBook(slug);
  if (!book) return { title: "Book not found", robots: { index: false, follow: false } };

  const title = `${book.title} — ${book.author}`;
  const url = `/book/${book.slug}`;
  return {
    title,
    description: book.blurb,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      url,
      title,
      description: book.blurb,
      siteName: SITE_NAME,
      // A Convex storage URL is absolute, so metadataBase leaves it alone; the
      // fallback is the site card.
      images: [book.coverUrl ?? "/images/og.jpg"],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: book.blurb,
      images: [book.coverUrl ?? "/images/og.jpg"],
    },
  };
}

// No generateStaticParams: the catalog is owner-editable at runtime (publish,
// unpublish, new books), so the book list can't be baked in at build time.
export default async function ProductPage({ params }: PageProps<"/book/[slug]">) {
  const { slug } = await params;
  const book = await getBook(slug);
  if (!book) notFound();

  const [blocks, categories, settings] = await Promise.all([
    fetchQuery(api.bookBlocks.listByBook, { bookId: book._id }),
    fetchQuery(api.categories.list),
    fetchQuery(api.storeSettings.get, {}),
  ]);
  const categoryTitle = categories.find((category) => category._id === book.categoryId)?.title ?? "";
  const sample = blocks.filter((block) => block.chapter === 1);

  // Product/Book structured data. The offer is only emitted when the store has
  // a base currency — a price without a currency is worse than no price.
  const currency = settings?.baseCurrency;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Book",
    name: book.title,
    author: { "@type": "Person", name: book.author },
    description: book.blurb,
    bookFormat: "https://schema.org/EBook",
    inLanguage: book.originalLang,
    url: `${SITE_URL}/book/${book.slug}`,
    ...(book.coverUrl ? { image: book.coverUrl } : {}),
    ...(categoryTitle ? { genre: categoryTitle } : {}),
    publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
    ...(currency
      ? {
          offers: {
            "@type": "Offer",
            price: (book.priceCents / minorUnitsPerMajor(currency)).toFixed(2),
            priceCurrency: currency,
            availability: "https://schema.org/InStock",
            url: `${SITE_URL}/book/${book.slug}`,
          },
        }
      : {}),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ProductDetailScreen book={book} categoryTitle={categoryTitle} sample={sample} />
    </>
  );
}
