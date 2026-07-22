import type { ReactNode } from "react";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { Logo } from "@/components/ui/Logo";
import { ADMIN_NAV } from "@/lib/nav";

const clerkConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

// Resource-based auth check (Clerk's current guidance, replacing path-matcher
// middleware): redirects to sign-in if signed out. Owner-only authorization
// itself is enforced per-request in Convex (requireOwner) — this only checks
// "signed in or not". Skipped until real Clerk keys are set (auth.protect()
// throws hard without a publishableKey) — admin stays open in the interim,
// same as before Clerk was wired.
export default async function AdminLayout({ children }: { children: ReactNode }) {
  if (clerkConfigured) await auth.protect();

  return (
    <div className="flex min-h-screen w-full gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <aside className="hidden w-64 shrink-0 rounded-card border border-border bg-surface p-4 shadow-soft lg:block">
        <Link href="/" className="flex items-center gap-3 rounded-2xl bg-mint px-4 py-3">
          <Logo className="h-9 w-9 shrink-0" />
          <span>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">The Safety Shelf</p>
            <p className="mt-2 text-lg font-semibold text-ink">Admin Workspace</p>
          </span>
        </Link>
        <nav className="mt-6 space-y-2">
          {ADMIN_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-xl px-3 py-2 text-sm font-medium text-muted transition hover:bg-background hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="min-w-0 flex-1">
        <div className="mb-6 flex items-center justify-between gap-4 rounded-card border border-border bg-surface px-4 py-3 shadow-soft">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Owner view</p>
            <p className="text-sm text-muted">
              {clerkConfigured
                ? "Mock dashboard cards now. Live agent tools later."
                : "No Clerk keys set — admin is unprotected. Add keys to .env.local to lock this down."}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/store" className="rounded-full border border-border px-4 py-2 text-sm font-medium text-muted transition hover:bg-background hover:text-ink">
              Open store
            </Link>
            <div className="grid h-11 w-11 place-items-center rounded-full bg-primary text-white">LS</div>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
