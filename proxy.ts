// Next.js 16 renamed `middleware.ts` → `proxy.ts` (same mechanism, new name).
// See node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md.
//
// This just establishes Clerk's auth context for every request. Route
// protection itself is a resource-based check (`auth.protect()` in
// app/(admin)/admin/layout.tsx) per Clerk's current guidance — path-matcher
// middleware (createRouteMatcher) is deprecated because it can diverge from
// how Next.js actually routes a request.
import { clerkMiddleware } from "@clerk/nextjs/server";

export const proxy = clerkMiddleware();

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico)).*)",
    "/(api|trpc)(.*)",
  ],
};
