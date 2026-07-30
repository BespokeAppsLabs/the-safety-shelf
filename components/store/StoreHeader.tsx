"use client";

import Link from "next/link";
import { Show, SignInButton, UserButton } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";
import { Logo } from "@/components/ui/Logo";
import { LanguagePicker } from "@/components/store/LanguagePicker";
import { api } from "@/convex/_generated/api";
import { useDict } from "@/app/I18nProvider";
import { STORE_NAV } from "@/lib/nav";

export function StoreHeader() {
  const dict = useDict();
  const { isAuthenticated } = useConvexAuth();
  const library = useQuery(api.entitlements.listForUser, isAuthenticated ? {} : "skip");
  const count = library?.length ?? 0;

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
              className="rounded-full px-4 py-2 text-sm font-medium text-muted transition hover:bg-white hover:text-ink"
            >
              {dict.nav[item.key]}
            </Link>
          ))}
          <Link href="/library" className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink shadow-soft transition hover:bg-background">
            {dict.nav.library}
            {count > 0 ? <span className="grid h-6 min-w-6 place-items-center rounded-full bg-primary px-1 text-xs text-white">{count}</span> : null}
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
