import type { Dictionary } from "./i18n";

// Nav labels are dictionary keys, not literals: the storefront nav is
// translated, the admin nav is not (owner-only, single operator).
export const STORE_NAV = [
  { href: "/", key: "home" },
  { href: "/store", key: "store" },
  { href: "/admin", key: "admin" },
] as const satisfies ReadonlyArray<{ href: string; key: keyof Dictionary["nav"] }>;

export const ADMIN_NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/books", label: "Catalog" },
  { href: "/admin/agent", label: "Agent" },
  // Social is hidden until the Postiz integration is wired — the page and its
  // route still exist, so restoring it is putting this line back.
  // { href: "/admin/social", label: "Social" },
  { href: "/admin/approvals", label: "Approvals" },
  { href: "/admin/settings", label: "Settings" },
];
