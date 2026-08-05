import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchQuery } from "convex/nextjs";
import { ReaderScreen } from "@/components/store/ReaderScreen";
import { api } from "@/convex/_generated/api";

// Paid book content. robots.txt disallows /read/, and this is the second lock:
// a crawler that reaches the page anyway must not index the text.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function ReadPage({ params }: PageProps<"/read/[slug]">) {
  const { slug } = await params;
  const book = await fetchQuery(api.books.getBySlug, { slug });
  if (!book) notFound();
  return <ReaderScreen book={book} />;
}
