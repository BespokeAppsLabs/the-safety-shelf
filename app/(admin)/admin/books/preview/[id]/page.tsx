import { AdminBookEditor } from "@/components/admin/AdminBookEditor";
import type { Id } from "@/convex/_generated/dataModel";

// Drafts are private. This durable-ID route is owner-only through the admin
// layout and opens the existing reader tab without exposing a public slug.
export default async function AdminBookPreviewPage({ params }: PageProps<"/admin/books/preview/[id]">) {
  const { id } = await params;
  return <AdminBookEditor bookId={id as Id<"books">} initialTab="read" />;
}
