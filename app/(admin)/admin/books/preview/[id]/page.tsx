import { AdminBookEditor } from "@/components/admin/AdminBookEditor";
import type { Id } from "@/convex/_generated/dataModel";

const TABS = ["details", "content", "images", "translations", "audio", "read"] as const;
type Tab = (typeof TABS)[number];

// Drafts are private. This durable-ID route is owner-only through the admin
// layout and opens the existing reader tab without exposing a public slug.
//
// `?tab=` exists so a link can land on the part of the book being discussed.
// Without it this page always opened Read, which renders the ORIGINAL — so the
// agent's "review this translation" link showed the English book with no sign
// of the translation it had just produced.
export default async function AdminBookPreviewPage({ params, searchParams }: PageProps<"/admin/books/preview/[id]">) {
  const { id } = await params;
  const { tab, lang } = await searchParams;
  const requested = Array.isArray(tab) ? tab[0] : tab;
  const initialTab: Tab = TABS.includes(requested as Tab) ? (requested as Tab) : "read";
  const initialLang = Array.isArray(lang) ? lang[0] : lang;

  return <AdminBookEditor bookId={id as Id<"books">} initialTab={initialTab} initialLang={initialLang} />;
}
