import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { fetchQuery } from "convex/nextjs";
import { ConvexClientProvider } from "./ConvexClientProvider";
import { I18nProvider } from "./I18nProvider";
import { api } from "@/convex/_generated/api";
import { getDictionary } from "@/lib/i18n";
import { DEFAULT_DISPLAY_CURRENCY, languageDir } from "@/lib/languages";
import { LOCALE_COOKIE } from "@/lib/locale";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/seo";
import { CURRENCY_COOKIE, CURRENCY_HEADER, LOCALE_HEADER } from "@/proxy";
import "./globals.css";

// Geist ships Latin and Latin-ext only. Greek, Arabic, Devanagari, Hangul and
// Kana have no Geist glyphs, so globals.css carries a system-font fallback chain
// for those scripts rather than pulling five more Noto families over the wire.
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin", "latin-ext"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME} — Practical health and safety guides`, template: `%s · ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    url: "/",
    title: `${SITE_NAME} — Practical health and safety guides`,
    description: SITE_DESCRIPTION,
    images: [{ url: "/images/og.jpg", width: 1200, height: 630, alt: `${SITE_NAME} — digital safety guides` }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — Practical health and safety guides`,
    description: SITE_DESCRIPTION,
    images: ["/images/og.jpg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
  },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // proxy.ts has already resolved these from Accept-Language / IP country and
  // pinned them to cookies, so the first paint is in the shopper's language —
  // no flash of English, no redirect.
  // proxy.ts forwards its resolution on the request headers as well as pinning
  // cookies. Headers are preferred because a cookie set by the proxy only
  // reaches the server on the NEXT request — reading cookies alone left a
  // first-time visitor with no currency and base-currency prices.
  const [jar, head] = await Promise.all([cookies(), headers()]);
  const lang = head.get(LOCALE_HEADER) ?? jar.get(LOCALE_COOKIE)?.value ?? "en";
  const currency = head.get(CURRENCY_HEADER) ?? jar.get(CURRENCY_COOKIE)?.value;

  const [dict, settings, rates] = await Promise.all([
    getDictionary(lang),
    fetchQuery(api.storeSettings.get, {}),
    fetchQuery(api.fxRates.list, {}),
  ]);

  // Pick the most useful currency we can actually convert into, stepping down
  // rather than jumping straight to base.
  //
  // A shopper we CAN place but have no rate for — Japan today, since fxRates
  // has USD only — would otherwise fall all the way back to rand, which is the
  // one currency an overseas shopper cannot judge. USD is a real rate the owner
  // set, not an invented one, so it is a better answer than ZAR. Base currency
  // remains the final fallback: always truthful, never guessed.
  const baseCurrency = settings?.baseCurrency ?? null;
  const rateFor = (code: string | undefined) =>
    code ? rates.find((row) => row.currency === code)?.rate : undefined;

  let displayCurrency = currency;
  let rate = rateFor(displayCurrency);
  if (!rate && displayCurrency && displayCurrency !== baseCurrency) {
    const fallbackRate = rateFor(DEFAULT_DISPLAY_CURRENCY);
    if (fallbackRate) {
      displayCurrency = DEFAULT_DISPLAY_CURRENCY;
      rate = fallbackRate;
    }
  }
  const dir = languageDir(lang);

  return (
    <html
      lang={lang}
      dir={dir}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full font-sans">
        <I18nProvider
          value={{
            lang,
            dir,
            locale: lang,
            dict,
            price: { baseCurrency, currency: displayCurrency, rate },
          }}
        >
          <ConvexClientProvider>{children}</ConvexClientProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
