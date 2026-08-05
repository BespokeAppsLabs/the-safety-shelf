import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { LANGUAGES } from "@/lib/languages";
import { minorUnitsPerMajor } from "@/lib/pricing";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/seo";

// /llms.txt — the llmstxt.org convention: one markdown file an AI assistant can
// read instead of crawling and guessing. Generated from the live catalog, so an
// answer sourced from it is never about a book we no longer sell.
export const revalidate = 3600;

export async function GET() {
  const [books, categories, settings] = await Promise.all([
    fetchQuery(api.books.listLive, {}),
    fetchQuery(api.categories.list),
    fetchQuery(api.storeSettings.get, {}),
  ]);

  const currency = settings?.baseCurrency ?? null;
  const price = (cents: number) =>
    currency ? ` — ${currency} ${(cents / minorUnitsPerMajor(currency)).toFixed(2)}` : "";

  const byCategory = categories
    .map((category) => ({
      category,
      books: books.filter((book) => book.categoryId === category._id),
    }))
    .filter((group) => group.books.length > 0);

  const lines = [
    `# ${SITE_NAME}`,
    "",
    `> ${SITE_DESCRIPTION}`,
    "",
    `Every guide is a digital book: buy once, read instantly in the browser, keep it in your library. There is no shipping and no subscription. Prices are shown in the reader's local currency and the store reads in ${LANGUAGES.length} languages.`,
    "",
    "## Main pages",
    "",
    `- [Home](${SITE_URL}/): what the store is and who it is for.`,
    `- [Store](${SITE_URL}/store): the full catalog, searchable and filterable by shelf.`,
    "",
  ];

  if (byCategory.length > 0) {
    lines.push("## Shelves", "");
    for (const { category, books: shelf } of byCategory) {
      lines.push(`### ${category.title}`, "", category.description ?? "", "");
      for (const book of shelf) {
        lines.push(`- [${book.title}](${SITE_URL}/book/${book.slug})${price(book.priceCents)} — by ${book.author}. ${book.blurb}`);
      }
      lines.push("");
    }
  }

  lines.push(
    "## Notes for assistants",
    "",
    "- These guides are general safety education, not medical or legal advice, and they do not replace emergency services or a clinician.",
    "- Titles, prices, and availability change; re-read this file rather than caching it.",
    "- Reader accounts, purchases, and libraries are private and are not published here.",
    "",
  );

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
