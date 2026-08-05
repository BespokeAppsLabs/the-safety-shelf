// Canonical public origin. Everything that has to emit an absolute URL —
// metadataBase, robots.txt, sitemap.xml, llms.txt, JSON-LD — reads it from
// here so a domain change is one edit. Override on a preview/staging
// deployment with NEXT_PUBLIC_SITE_URL; the default is the live domain.
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.safety-shelf.co.za";

export const SITE_NAME = "The Safety Shelf";

export const SITE_DESCRIPTION =
  "Practical digital health and safety guides for families, homes, and workplaces — pregnancy and newborn care, first aid, emergency preparedness, food hygiene, and workplace safety. Instant access, read in your language on any device.";

/** Private or owner-only routes. Kept out of robots.txt, sitemap.xml and llms.txt alike. */
export const PRIVATE_PATHS = ["/admin", "/api", "/library", "/read", "/payments"];
