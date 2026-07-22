import { notFound } from "next/navigation";
import { fetchQuery } from "convex/nextjs";
import { ReaderScreen } from "@/components/store/ReaderScreen";
import { api } from "@/convex/_generated/api";

export default async function ReadPage({ params }: PageProps<"/read/[slug]">) {
  const { slug } = await params;
  const book = await fetchQuery(api.books.getBySlug, { slug });
  if (!book) notFound();
  return <ReaderScreen book={book} />;
}
