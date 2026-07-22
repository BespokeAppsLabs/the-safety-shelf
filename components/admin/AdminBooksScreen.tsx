"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { Badge } from "@/components/ui/Badge";
import { Table } from "@/components/ui/Table";
import { api } from "@/convex/_generated/api";
import { languageLabel } from "@/lib/languages";
import { formatPrice } from "@/lib/money";

const STATUS_VARIANT = {
  live: "success",
  draft: "info",
  archived: "warning",
} as const;

export function AdminBooksScreen() {
  const books = useQuery(api.books.catalog);
  const categories = useQuery(api.categories.list);
  const salesCounts = useQuery(api.books.salesCounts);

  const categoryTitleById = new Map((categories ?? []).map((category) => [category._id, category.title]));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Catalog</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-ink">Guide inventory and status.</h1>
        <p className="mt-3 text-base text-muted">Every book, its languages, and its audiobooks.</p>
      </div>
      {books === undefined || categories === undefined || salesCounts === undefined ? (
        <p className="text-sm text-muted">Loading catalog…</p>
      ) : (
        <Table>
          <thead className="bg-background text-xs uppercase tracking-[0.2em] text-muted">
            <tr>
              <th className="px-4 py-4 font-semibold">Guide</th>
              <th className="px-4 py-4 font-semibold">Status</th>
              <th className="px-4 py-4 font-semibold">Languages</th>
              <th className="px-4 py-4 font-semibold">Audio</th>
              <th className="px-4 py-4 font-semibold">Price</th>
              <th className="px-4 py-4 font-semibold">Sold</th>
              <th className="px-4 py-4 font-semibold"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {books.map((book) => (
              <tr key={book.slug}>
                <td className="px-4 py-4">
                  <p className="font-semibold text-ink">{book.title}</p>
                  <p className="mt-1 text-sm text-muted">{categoryTitleById.get(book.categoryId)}</p>
                </td>
                <td className="px-4 py-4"><Badge variant={STATUS_VARIANT[book.status]}>{book.status}</Badge></td>
                <td className="px-4 py-4">
                  <div className="flex flex-wrap gap-1">
                    {book.textLangs.map((lang) => (
                      <Badge key={lang} variant={lang === book.originalLang ? "info" : "neutral"}>
                        {languageLabel(lang)}
                      </Badge>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-4">
                  {book.audioLangs.length ? (
                    <div className="flex flex-wrap gap-1">
                      {book.audioLangs.map((lang) => (
                        <Badge key={lang} variant="success">🔊 {languageLabel(lang)}</Badge>
                      ))}
                    </div>
                  ) : (
                    <span className="text-sm text-muted">—</span>
                  )}
                </td>
                <td className="px-4 py-4 text-muted">{formatPrice(book.priceCents)}</td>
                <td className="px-4 py-4 text-muted">{salesCounts[book._id] ?? 0}</td>
                <td className="px-4 py-4 text-right">
                  <Link href={`/admin/books/${book.slug}`} className="text-sm font-semibold text-primary">Edit →</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
