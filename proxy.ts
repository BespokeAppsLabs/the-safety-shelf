// Next.js 16 renamed `middleware.ts` → `proxy.ts` (same mechanism, new name).
// See node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md.
//
// Two jobs:
//  1. Establish Clerk's auth context for every request. Route protection itself
//     is a resource-based check (`auth.protect()` in app/(admin)/admin/layout.tsx)
//     per Clerk's current guidance — path-matcher middleware (createRouteMatcher)
//     is deprecated because it can diverge from how Next.js actually routes a
//     request.
//  2. Resolve the shopper's language and display currency and pin them to
//     cookies, so the site is translated on first paint with no redirect and no
//     /[lang]/ URL segment.
import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { LOCALE_COOKIE, resolveCurrency, resolveLanguage } from "@/lib/locale";

export const CURRENCY_COOKIE = "currency";

// A year: a shopper who picked a language should not be re-guessed at them next
// week. The picker overwrites this cookie, and it always outranks detection.
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const proxy = clerkMiddleware(async (_auth, request) => {
  const response = NextResponse.next();

  // Vercel resolves the client IP to a country at the edge and attaches it as a
  // request header — no geo-IP dependency, no extra lookup.
  const country = request.headers.get("x-vercel-ip-country");
  const chosen = request.cookies.get(LOCALE_COOKIE)?.value;

  const lang = resolveLanguage({
    cookie: chosen,
    acceptLanguage: request.headers.get("accept-language"),
    country,
  });

  // Only write when it actually changed: an unconditional Set-Cookie on every
  // request makes the response uncacheable for no benefit.
  if (chosen !== lang) {
    response.cookies.set(LOCALE_COOKIE, lang, { maxAge: COOKIE_MAX_AGE, sameSite: "lax", path: "/" });
  }

  // Currency follows the shopper's country, not their language — Arabic spans
  // four of this store's markets with four different currencies.
  const currency = resolveCurrency(country);
  if (currency && request.cookies.get(CURRENCY_COOKIE)?.value !== currency) {
    response.cookies.set(CURRENCY_COOKIE, currency, { maxAge: COOKIE_MAX_AGE, sameSite: "lax", path: "/" });
  }

  return response;
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico)).*)",
    "/(api|trpc)(.*)",
  ],
};
