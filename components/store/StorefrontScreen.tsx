"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { ProductCard } from "@/components/store/ProductCard";
import { Container } from "@/components/ui/Container";
import { Input } from "@/components/ui/Input";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export function StorefrontScreen() {
  const books = useQuery(api.books.listLive);
  const categories = useQuery(api.categories.list);
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<Id<"categories"> | "all">("all");

  const categoryTitleById = useMemo(
    () => new Map((categories ?? []).map((category) => [category._id, category.title])),
    [categories],
  );

  const filtered = useMemo(() => {
    if (!books) return [];
    return books.filter((book) => {
      const matchesCategory = categoryId === "all" || book.categoryId === categoryId;
      const haystack = `${book.title} ${book.author} ${book.blurb}`.toLowerCase();
      return matchesCategory && haystack.includes(query.toLowerCase());
    });
  }, [books, categoryId, query]);

  if (books === undefined || categories === undefined) {
    return (
      <Container>
        <p className="py-20 text-center text-sm text-muted">Loading guides…</p>
      </Container>
    );
  }

  return (
    <Container>
      <SectionHeader
        eyebrow="Storefront"
        title="Browse practical safety guides."
        body="Digital titles only for now. Buy once, keep them in your library, and read in-browser."
      />
      <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <Input
          placeholder="Search guides, topics, or authors"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setCategoryId("all")}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${categoryId === "all" ? "bg-primary text-white" : "bg-white text-muted hover:bg-background hover:text-ink"}`}
          >
            All
          </button>
          {categories.map((category) => (
            <button
              key={category._id}
              onClick={() => setCategoryId(category._id)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${categoryId === category._id ? "bg-primary text-white" : "bg-white text-muted hover:bg-background hover:text-ink"}`}
            >
              {category.title}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((book) => (
          <ProductCard key={book.slug} book={book} categoryTitle={categoryTitleById.get(book.categoryId)} />
        ))}
      </div>
    </Container>
  );
}
