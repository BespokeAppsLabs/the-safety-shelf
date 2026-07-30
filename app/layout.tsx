import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { fetchQuery } from "convex/nextjs";
import { ConvexClientProvider } from "./ConvexClientProvider";
import { I18nProvider } from "./I18nProvider";
import { api } from "@/convex/_generated/api";
import { getDictionary } from "@/lib/i18n";
import { languageDir } from "@/lib/languages";
import { LOCALE_COOKIE } from "@/lib/locale";
import "./globals.css";

// Geist ships Latin and Latin-ext only. Greek, Arabic, Devanagari, Hangul and
// Kana have no Geist glyphs, so globals.css carries a system-font fallback chain
// for those scripts rather than pulling five more Noto families over the wire.
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin", "latin-ext"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "The Safety Shelf",
  description: "Health and safety awareness through practical digital guides.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // proxy.ts has already resolved these from Accept-Language / IP country and
  // pinned them to cookies, so the first paint is in the shopper's language —
  // no flash of English, no redirect.
  const jar = await cookies();
  const lang = jar.get(LOCALE_COOKIE)?.value ?? "en";
  const currency = jar.get("currency")?.value;

  const [dict, settings, rates] = await Promise.all([
    getDictionary(lang),
    fetchQuery(api.storeSettings.get, {}),
    fetchQuery(api.fxRates.list, {}),
  ]);

  // No rate for this currency is a normal state — the shopper simply sees
  // base-currency prices instead of a made-up conversion.
  const rate = currency ? rates.find((row) => row.currency === currency)?.rate : undefined;
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
            price: { baseCurrency: settings?.baseCurrency ?? null, currency, rate },
          }}
        >
          <ConvexClientProvider>{children}</ConvexClientProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
