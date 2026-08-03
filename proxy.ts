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

// Same values, forwarded on the request so the first uncookied paint is already
// localised. Read by app/layout.tsx in preference to the cookies.
export const LOCALE_HEADER = "x-tss-locale";
export const CURRENCY_HEADER = "x-tss-currency";

// A year: a shopper who picked a language should not be re-guessed at them next
// week. The picker overwrites this cookie, and it always outranks detection.
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const proxy = clerkMiddleware(async (_auth, request) => {
  // Vercel resolves the client IP to a country at the edge and attaches it as a
  // request header — no geo-IP dependency, no extra lookup.
  const country = request.headers.get("x-vercel-ip-country");
  const chosen = request.cookies.get(LOCALE_COOKIE)?.value;

  const lang = resolveLanguage({
    cookie: chosen,
    acceptLanguage: request.headers.get("accept-language"),
    country,
  });

  // Currency follows the shopper's country, not their language — Arabic spans
  // four of this store's markets with four different currencies.
  const currency = resolveCurrency(country);

  // Forward the resolution on the REQUEST, not just as response cookies.
  // Cookies set here only reach the server on the NEXT request, so a first-time
  // visitor used to render with no currency at all and fall back to base — the
  // one currency an overseas shopper cannot judge. These headers make the very
  // first paint correct; the cookies below persist the choice for the picker.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(LOCALE_HEADER, lang);
  requestHeaders.set(CURRENCY_HEADER, currency);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  // Only write when it actually changed: an unconditional Set-Cookie on every
  // request makes the response uncacheable for no benefit.
  if (chosen !== lang) {
    response.cookies.set(LOCALE_COOKIE, lang, { maxAge: COOKIE_MAX_AGE, sameSite: "lax", path: "/" });
  }

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
