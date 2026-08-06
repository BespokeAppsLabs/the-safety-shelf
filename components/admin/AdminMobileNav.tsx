"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/ui/Logo";
import { ADMIN_NAV } from "@/lib/nav";

// The admin sidebar is `hidden lg:block`, so below 1024px the entire admin nav
// was unreachable — no burger, no fallback, the links simply did not exist in
// the layout. This is that missing entry point.
//
// Native <dialog> for the same reasons components/ui/Dialog.tsx gives: focus
// trap, Esc-to-close and an inert backdrop with no library. That component is
// centred and max-width-capped for its modal callers, so a left-anchored drawer
// is its own element rather than a second layout mode bolted onto it.
export function AdminMobileNav() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      // Focus the close button explicitly. React's `autoFocus` prop is an
      // imperative .focus() on mount, not a rendered `autofocus` attribute, so
      // showModal()'s own autofocus step finds nothing and parks the caret on
      // the first focusable — the brand link, where a keyboard user's first
      // Enter would leave the admin workspace entirely.
      closeRef.current?.focus();
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  // The admin layout persists across route changes, so without this the drawer
  // stays open on top of the page it just navigated to. Keying off pathname
  // rather than the link's onClick also covers back/forward. It does not cover
  // re-selecting the current page — same pathname, no rerun — so the links
  // close it themselves as well.
  useEffect(() => setOpen(false), [pathname]);

  // Widening past `lg` reveals the sidebar this drawer stands in for, and a
  // modal <dialog> keeps the page behind it inert — so an open drawer would
  // cover the nav it duplicates. Only listens while open. 64rem is Tailwind's
  // `lg`, in rem so it tracks the root font size the way the class does.
  useEffect(() => {
    if (!open) return;
    const mq = window.matchMedia("(min-width: 64rem)");
    const onChange = () => {
      if (mq.matches) setOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [open]);

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open admin menu"
        aria-expanded={open}
        aria-controls="admin-mobile-nav"
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-border text-muted transition hover:bg-background hover:text-ink lg:hidden"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>

      {/* No `lg:hidden` here on purpose: a modal <dialog> makes the rest of the
          page inert, so hiding an open one at a breakpoint would leave an
          invisible drawer blocking every click. The burger is the only opener
          and it is already lg:hidden. */}
      <dialog
        ref={ref}
        id="admin-mobile-nav"
        aria-label="Admin navigation"
        onClose={() => setOpen(false)}
        onClick={(event) => {
          if (event.target === ref.current) setOpen(false);
        }}
        className="m-0 h-full max-h-full w-80 max-w-[85vw] bg-transparent p-3 backdrop:bg-ink/50"
      >
        {open ? (
          <div className="flex h-full flex-col overflow-y-auto rounded-card border border-border bg-surface p-4 shadow-soft">
            <div className="flex items-start justify-between gap-3">
              <Link href="/" className="flex min-w-0 items-center gap-3 rounded-2xl bg-mint px-4 py-3">
                <Logo className="h-9 w-9 shrink-0" />
                <span className="min-w-0">
                  {/* No `truncate` here, unlike StoreHeader: the eyebrow's wide
                      tracking clips to "THE SAFE…" inside a drawer this narrow,
                      so let it wrap on the smallest phones instead. */}
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
                    The Safety Shelf
                  </p>
                  <p className="mt-2 text-lg font-semibold text-ink">Admin</p>
                </span>
              </Link>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close admin menu"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-border text-muted transition hover:bg-background hover:text-ink"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <nav className="mt-6 space-y-2">
              {ADMIN_NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className={`block rounded-xl px-3 py-3 text-sm font-medium transition ${
                    isActive(item.href)
                      ? "bg-mint text-ink"
                      : "text-muted hover:bg-background hover:text-ink"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            {/* The topbar's "Open store" is sm:inline-block — too wide to sit
                next to the burger on a phone — so it lives here below that. */}
            <Link
              href="/store"
              className="mt-auto block rounded-full border border-border px-4 py-3 text-center text-sm font-medium text-muted transition hover:bg-background hover:text-ink sm:hidden"
            >
              Open store
            </Link>
          </div>
        ) : null}
      </dialog>
    </>
  );
}
