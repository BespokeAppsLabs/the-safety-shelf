import "server-only";
import { cookies } from "next/headers";
import { getDictionary, type Dictionary } from "./i18n";
import { languageDir } from "./languages";
import { LOCALE_COOKIE } from "./locale";

/**
 * Dictionary access for server components. They sit inside I18nProvider but
 * cannot read React context, so they re-read the cookie proxy.ts already
 * resolved. Cheap: the JSON import is module-cached after the first call.
 */
export async function getServerI18n(): Promise<{
  lang: string;
  dir: "ltr" | "rtl";
  dict: Dictionary;
}> {
  const lang = (await cookies()).get(LOCALE_COOKIE)?.value ?? "en";
  return { lang, dir: languageDir(lang), dict: await getDictionary(lang) };
}
