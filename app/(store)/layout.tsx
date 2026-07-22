import type { ReactNode } from "react";
import { StoreHeader } from "@/components/store/StoreHeader";

export default function StoreLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <StoreHeader />
      <main className="pb-14 pt-8">
        {children}
      </main>
      <footer className="border-t border-border py-8">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-4 text-sm text-muted sm:px-6">
          <p>The Safety Shelf demo storefront.</p>
          <p>Mock catalog and local purchases now. Convex, Clerk, Stripe, and agent tools later.</p>
        </div>
      </footer>
    </>
  );
}
