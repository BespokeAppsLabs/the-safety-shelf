import type { ReactNode } from "react";
import { StoreHeader } from "@/components/store/StoreHeader";
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
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-4 text-sm text-muted sm:px-6">
          <p>{dict.footer.demoLine1}</p>
          <p>{dict.footer.demoLine2}</p>
        </div>
      </footer>
    </>
  );
}
