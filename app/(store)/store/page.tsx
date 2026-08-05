import type { Metadata } from "next";
import { Suspense } from "react";
import { StorefrontScreen } from "@/components/store/StorefrontScreen";

export const metadata: Metadata = {
  title: "Store",
  description:
    "Browse every safety guide: pregnancy and newborn care, child safety, first aid, emergency preparedness, food hygiene, and workplace safety. Buy once, read instantly.",
  alternates: { canonical: "/store" },
};

export default function StorePage() {
  return (
    <Suspense fallback={<p className="py-20 text-center text-sm text-muted">Loading guides…</p>}>
      <StorefrontScreen />
    </Suspense>
  );
}
