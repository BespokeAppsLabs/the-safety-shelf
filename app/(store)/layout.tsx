import type { ReactNode } from "react";
import Link from "next/link";
import { StoreHeader } from "@/components/store/StoreHeader";
import { fill } from "@/lib/i18n";
import { getServerI18n } from "@/lib/i18n.server";

export default async function StoreLayout({ children }: { children: ReactNode }) {
  const { dict } = await getServerI18n();
  return (
    <>
      <StoreHeader />
      <main className="pb-14 pt-8 print:p-0">
        {children}
      </main>
      <footer className="border-t border-border py-8 print:hidden">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>{dict.brand.strapline}</p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Link href="/store" className="hover:text-ink">{dict.nav.store}</Link>
            <Link href="/library" className="hover:text-ink">{dict.nav.library}</Link>
            <span>{fill(dict.footer.copyright, { year: new Date().getFullYear() })}</span>
          </div>
        </div>
      </footer>
    </>
  );
}
