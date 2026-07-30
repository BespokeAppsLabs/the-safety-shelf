import { Suspense } from "react";
import { StorefrontScreen } from "@/components/store/StorefrontScreen";

export default function StorePage() {
  return (
    <Suspense fallback={<p className="py-20 text-center text-sm text-muted">Loading guides…</p>}>
      <StorefrontScreen />
    </Suspense>
  );
}
