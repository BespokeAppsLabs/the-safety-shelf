import type { MetadataRoute } from "next";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { SITE_URL } from "@/lib/seo";

// The catalog is owner-editable at runtime, so this can't be a build-time
// snapshot. Rebuild hourly instead of per request — crawlers don't need a
// published book to appear within seconds, and Convex doesn't need the traffic.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const books = await fetchQuery(api.books.listLive, {});

  return [
    { url: SITE_URL, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/store`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    ...books.map((book) => ({
      url: `${SITE_URL}/book/${book.slug}`,
      // _creationTime is the only timestamp on a book row; edits don't bump it,
      // so treat it as "exists since" rather than "changed at".
      lastModified: new Date(book._creationTime),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
