import { Suspense } from "react";
import { CheckoutCallbackScreen } from "@/components/store/CheckoutCallbackScreen";

// useSearchParams needs a Suspense boundary to keep the rest of the route
// static.
export default function CheckoutCallbackPage() {
  return (
    <Suspense>
      <CheckoutCallbackScreen />
    </Suspense>
  );
}
