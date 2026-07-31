"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Show, SignInButton, UserButton } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";
import { Logo } from "@/components/ui/Logo";
import { LanguagePicker } from "@/components/store/LanguagePicker";
import { api } from "@/convex/_generated/api";
import { useDict } from "@/app/I18nProvider";
import { STORE_NAV } from "@/lib/nav";

// Same pill language as the storefront's category chips (StorefrontScreen):
// the current page is a filled primary pill, everything else is quiet. Before
// this, every nav item rendered identically and only Library carried a shadow,
// so Library read as "selected" on every page.
const NAV_LINK = "rounded-full px-4 py-2 text-sm font-semibold transition";
const NAV_ACTIVE = "bg-primary text-white";
const NAV_IDLE = "text-muted hover:bg-white hover:text-ink";

export function StoreHeader() {
  const dict = useDict();
  const pathname = usePathname();
  const { isAuthenticated } = useConvexAuth();
  const library = useQuery(api.entitlements.listForUser, isAuthenticated ? {} : "skip");
  const count = library?.length ?? 0;

  // A book's storefront page is part of browsing the store; the reader is part
  // of your library. Without this, those two pages highlight nothing and the
  // "which page am I on" question comes back.
  const section = pathname.startsWith("/book/")
    ? "/store"
    : pathname.startsWith("/read/")
      ? "/library"
      : pathname;

  // "/" only matches itself; everything else also covers its sub-routes.
  const isActive = (href: string) => (href === "/" ? section === "/" : section.startsWith(href));

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-paper/90 backdrop-blur print:hidden">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <Logo className="h-9 w-9 shrink-0" />
          <span className="min-w-0">
            <p className="truncate text-xs font-semibold uppercase tracking-[0.24em] text-primary">{dict.brand.name}</p>
            <p className="truncate text-sm text-muted">{dict.brand.tagline}</p>
          </span>
        </Link>
        <nav className="flex flex-wrap items-center gap-2">
          {STORE_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={`${NAV_LINK} ${isActive(item.href) ? NAV_ACTIVE : NAV_IDLE}`}
            >
              {dict.nav[item.key]}
            </Link>
          ))}
          <Link
            href="/library"
            aria-current={isActive("/library") ? "page" : undefined}
            className={`inline-flex items-center gap-2 ${NAV_LINK} ${isActive("/library") ? NAV_ACTIVE : NAV_IDLE}`}
          >
            {dict.nav.library}
            {count > 0 ? (
              <span
                className={`grid h-6 min-w-6 place-items-center rounded-full px-1 text-xs ${
                  isActive("/library") ? "bg-white text-primary" : "bg-primary text-white"
                }`}
              >
                {count}
              </span>
            ) : null}
          </Link>
          <Show when="signed-out">
            <SignInButton mode="modal">
              <button className="rounded-full border border-border px-4 py-2 text-sm font-medium text-ink transition hover:bg-background">
                {dict.auth.signIn}
              </button>
            </SignInButton>
          </Show>
          <Show when="signed-in">
            <UserButton />
          </Show>
          <LanguagePicker />
        </nav>
      </div>
    </header>
  );
}
