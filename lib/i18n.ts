// Dictionary loading and lookup.
//
// Components read the dictionary as a plain typed object (`d.product.viewGuide`)
// rather than through a t("product.viewGuide") string lookup. TypeScript then
// catches a renamed or deleted key at build time instead of rendering the key
// path to a customer.
import en from "./dictionaries/en.json";
import { DEFAULT_LANGUAGE, isLanguageCode, type LanguageCode } from "./languages";

export type Dictionary = typeof en;

/**
 * Overlay a translation on English. A translator who has not reached a key yet
 * — or a new key added after the translations were generated — falls through to
 * readable English instead of a blank or a raw key path.
 */
function mergeOverDefault<T>(base: T, override: unknown): T {
  if (override === null || override === undefined) return base;
  if (Array.isArray(base)) {
    // Arrays are whole units here (promises, trust marks). A partial translated
    // array must not be spliced element-wise into the English one.
    return (Array.isArray(override) && override.length === base.length ? override : base) as T;
  }
  if (typeof base === "object" && typeof override === "object") {
    const out = { ...(base as Record<string, unknown>) };
    for (const key of Object.keys(out)) {
      out[key] = mergeOverDefault(out[key], (override as Record<string, unknown>)[key]);
    }
    return out as T;
  }
  return (typeof override === typeof base ? override : base) as T;
}

export async function getDictionary(lang: string): Promise<Dictionary> {
  if (!isLanguageCode(lang) || lang === DEFAULT_LANGUAGE) return en;
  try {
    const loaded = (await import(`./dictionaries/${lang}.json`)).default;
    return mergeOverDefault(en, loaded);
  } catch {
    // A language listed in LANGUAGES but not yet translated is a normal state,
    // not an outage — serve English rather than failing the page.
    return en;
  }
}

/**
 * Substitute {named} placeholders. Deliberately not a template engine: the only
 * thing dictionary strings interpolate is a value the caller already computed.
 */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    key in values ? String(values[key]) : match,
  );
}

/** Plural pick for the one counted string in the UI. */
export function plural(
  count: number,
  forms: { countOne: string; countOther: string },
): string {
  return fill(count === 1 ? forms.countOne : forms.countOther, { count });
}

export type { LanguageCode };
