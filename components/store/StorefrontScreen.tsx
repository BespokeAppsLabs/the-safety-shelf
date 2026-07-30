"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { ProductCard } from "@/components/store/ProductCard";
import { Container } from "@/components/ui/Container";
import { Input } from "@/components/ui/Input";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { api } from "@/convex/_generated/api";
import { useDict } from "@/app/I18nProvider";

export function StorefrontScreen() {
  const dict = useDict();
  const books = useQuery(api.books.listLive);
  const categories = useQuery(api.categories.list);
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const categorySlug = searchParams.get("category");
  const categoryId = categories?.find((category) => category.slug === categorySlug)?._id ?? "all";

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
        <p className="py-20 text-center text-sm text-muted">{dict.storefront.loading}</p>
      </Container>
    );
  }

  return (
    <Container>
      <SectionHeader
        eyebrow={dict.storefront.eyebrow}
        title={dict.storefront.title}
        body={dict.storefront.body}
      />
      <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <Input
          placeholder={dict.storefront.searchPlaceholder}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <Link
            href="/store"
            aria-current={categoryId === "all" ? "page" : undefined}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${categoryId === "all" ? "bg-primary text-white" : "bg-white text-muted hover:bg-background hover:text-ink"}`}
          >
            {dict.storefront.all}
          </Link>
          {categories.map((category) => (
            <Link
              key={category._id}
              href={{ pathname: "/store", query: { category: category.slug } }}
              aria-current={categoryId === category._id ? "page" : undefined}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${categoryId === category._id ? "bg-primary text-white" : "bg-white text-muted hover:bg-background hover:text-ink"}`}
            >
              {category.title}
            </Link>
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
