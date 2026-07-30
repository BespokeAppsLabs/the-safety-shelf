"use client";

import { useRouter } from "next/navigation";
import { useI18n } from "@/app/I18nProvider";
import { LANGUAGES } from "@/lib/languages";
import { LOCALE_COOKIE } from "@/lib/locale";

/**
 * Explicit override for the auto-detected language. Writing the same cookie
 * proxy.ts reads is what makes the choice stick — the detection chain checks
 * the cookie first, so a shopper who picks Greek stays in Greek even though
 * their IP says Japan.
 *
 * router.refresh() re-renders the server tree with the new cookie, which is
 * what re-resolves the dictionary; a client-side state flip could not, because
 * the strings are resolved in the root layout.
 */
export function LanguagePicker({ className }: { className?: string }) {
  const { lang, dict } = useI18n();
  const router = useRouter();

  return (
    <label className={className}>
      <span className="sr-only">{dict.nav.language}</span>
      <select
        value={lang}
        onChange={(event) => {
          const next = event.target.value;
          document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
          router.refresh();
        }}
        className="rounded-full border border-border bg-white px-3 py-2 text-sm font-medium text-ink outline-none transition hover:bg-background focus:border-primary"
      >
        {LANGUAGES.map((language) => (
          <option key={language.code} value={language.code}>
            {language.native}
          </option>
        ))}
      </select>
    </label>
  );
}
