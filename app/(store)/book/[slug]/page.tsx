import { notFound } from "next/navigation";
import { fetchQuery } from "convex/nextjs";
import { ProductDetailScreen } from "@/components/store/ProductDetailScreen";
import { api } from "@/convex/_generated/api";

// No generateStaticParams: the catalog is owner-editable at runtime (publish,
// unpublish, new books), so the book list can't be baked in at build time.
export default async function ProductPage({ params }: PageProps<"/book/[slug]">) {
  const { slug } = await params;
  const book = await fetchQuery(api.books.getBySlug, { slug });
  if (!book) notFound();

  const [blocks, categories] = await Promise.all([
    fetchQuery(api.bookBlocks.listByBook, { bookId: book._id }),
    fetchQuery(api.categories.list),
  ]);
  const categoryTitle = categories.find((category) => category._id === book.categoryId)?.title ?? "";
  const sample = blocks.filter((block) => block.chapter === 1);

  return <ProductDetailScreen book={book} categoryTitle={categoryTitle} sample={sample} />;
}
