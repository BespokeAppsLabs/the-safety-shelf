import { AdminBookEditor } from "@/components/admin/AdminBookEditor";

export default async function AdminBookEditPage({ params }: PageProps<"/admin/books/[slug]">) {
  const { slug } = await params;
  return <AdminBookEditor slug={slug} />;
}
