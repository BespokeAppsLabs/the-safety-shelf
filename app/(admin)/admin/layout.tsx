import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import { fetchQuery } from "convex/nextjs";
import { AdminAccessDenied } from "@/components/auth/AdminAccessDenied";
import { Logo } from "@/components/ui/Logo";
import { api } from "@/convex/_generated/api";
import { isAdminOwner } from "@/lib/adminAccess";
import { ADMIN_NAV } from "@/lib/nav";

const clerkConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

// Fail closed before rendering any admin UI. Clerk identifies the request and
// Convex remains the role authority, so a customer cannot reach this layout
// merely by knowing an /admin URL.
export default async function AdminLayout({ children }: { children: ReactNode }) {
  if (!clerkConfigured) return <AdminAccessDenied />;

  await auth.protect();
  try {
    const { getToken, sessionClaims } = await auth();
    const token = sessionClaims?.aud === "convex"
      ? await getToken()
      : await getToken({ template: "convex" });
    const viewer = token ? await fetchQuery(api.users.getViewer, {}, { token }) : null;
    if (!isAdminOwner(viewer?.role)) return <AdminAccessDenied />;
  } catch {
    return <AdminAccessDenied />;
  }

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
              Owner-authorized workspace
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/store" className="rounded-full border border-border px-4 py-2 text-sm font-medium text-muted transition hover:bg-background hover:text-ink">
              Open store
            </Link>
            {/* Sign out lives in this menu. Sized to the 44px avatar the topbar
                used to fake with a hardcoded div. */}
            <UserButton appearance={{ elements: { userButtonAvatarBox: "h-11 w-11" } }} />
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
