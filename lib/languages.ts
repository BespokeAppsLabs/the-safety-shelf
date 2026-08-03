// The store's language and region tables.
//
// Language and country are deliberately separate axes. Arabic alone covers
// Egypt, Lebanon, Saudi Arabia and the UAE — one dictionary, four currencies —
// so currency is keyed off country and never off language. Collapsing them
// would price a Cairo shopper in dirhams.
//
// This is ISO reference data, not configuration: what a shopper is *charged*
// comes from the database (storeSettings.baseCurrency + fxRates). This table
// only decides which language they read and which currency their country uses.
export const LANGUAGES = [
  { code: "en", label: "English", native: "English", dir: "ltr" },
  { code: "af", label: "Afrikaans", native: "Afrikaans", dir: "ltr" },
  { code: "zu", label: "isiZulu", native: "isiZulu", dir: "ltr" },
  { code: "xh", label: "isiXhosa", native: "isiXhosa", dir: "ltr" },
  { code: "st", label: "Sesotho", native: "Sesotho", dir: "ltr" },
  { code: "tn", label: "Setswana", native: "Setswana", dir: "ltr" },
  { code: "fr", label: "French", native: "Français", dir: "ltr" },
  { code: "pt", label: "Portuguese", native: "Português", dir: "ltr" },
  { code: "es", label: "Spanish", native: "Español", dir: "ltr" },
  { code: "de", label: "German", native: "Deutsch", dir: "ltr" },
  { code: "it", label: "Italian", native: "Italiano", dir: "ltr" },
  { code: "el", label: "Greek", native: "Ελληνικά", dir: "ltr" },
  { code: "nl", label: "Dutch", native: "Nederlands", dir: "ltr" },
  { code: "id", label: "Indonesian", native: "Bahasa Indonesia", dir: "ltr" },
  { code: "ms", label: "Malay", native: "Bahasa Melayu", dir: "ltr" },
  { code: "hi", label: "Hindi", native: "हिन्दी", dir: "ltr" },
  { code: "ko", label: "Korean", native: "한국어", dir: "ltr" },
  { code: "ja", label: "Japanese", native: "日本語", dir: "ltr" },
  { code: "sw", label: "Swahili", native: "Kiswahili", dir: "ltr" },
  { code: "zh", label: "Chinese (Simplified)", native: "简体中文", dir: "ltr" },
  { code: "ar", label: "Arabic", native: "العربية", dir: "rtl" },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]["code"];

export const DEFAULT_LANGUAGE: LanguageCode = "en";

export function languageLabel(code: string): string {
  return LANGUAGES.find((l) => l.code === code)?.label ?? code;
}

/** The language's own name — what belongs in a language picker. */
export function languageNative(code: string): string {
  return LANGUAGES.find((l) => l.code === code)?.native ?? code;
}

export function languageDir(code: string): "ltr" | "rtl" {
  return LANGUAGES.find((l) => l.code === code)?.dir ?? "ltr";
}

export function isLanguageCode(code: string): code is LanguageCode {
  return LANGUAGES.some((l) => l.code === code);
}

/**
 * Country → language, for shoppers whose browser sends no usable
 * Accept-Language. Covers the store's target markets only; anywhere else falls
 * through to English rather than guessing a language from a continent.
 */
export const COUNTRY_LANGUAGE: Record<string, LanguageCode> = {
  IT: "it", ES: "es", GR: "el", CY: "el",
  ID: "id", MY: "ms", IN: "hi", KR: "ko", JP: "ja",
  FR: "fr", BE: "fr", NL: "nl",
  EG: "ar", LB: "ar", SA: "ar", AE: "ar", QA: "ar", KW: "ar", BH: "ar", OM: "ar", JO: "ar",
  DE: "de", AT: "de", CH: "de",
  PT: "pt", BR: "pt", MX: "es", AR: "es", CL: "es", CO: "es",
  KE: "sw", TZ: "sw", UG: "sw",
  CN: "zh", TW: "zh", HK: "zh",
  ZA: "en", NA: "en", BW: "en", SG: "en",
};

/**
 * Country → ISO currency. Separate from language precisely because Arabic and
 * Spanish each span several currency zones.
 */
/**
 * What a shopper sees when we cannot place them.
 *
 * Deliberately NOT the store's base currency. Prices settle in ZAR, but the
 * store sells worldwide and an unplaceable visitor reading rand has no idea
 * what the book costs them. USD is the currency the most people can price a
 * thing in without conversion.
 *
 * Only affects DISPLAY. The charge is always base currency — see
 * docs/10-payments.md.
 */
export const DEFAULT_DISPLAY_CURRENCY = "USD";

export const COUNTRY_CURRENCY: Record<string, string> = {
  IT: "EUR", ES: "EUR", GR: "EUR", CY: "EUR", FR: "EUR", BE: "EUR", NL: "EUR",
  DE: "EUR", AT: "EUR", PT: "EUR", IE: "EUR", FI: "EUR",
  ID: "IDR", MY: "MYR", IN: "INR", KR: "KRW", JP: "JPY",
  EG: "EGP", LB: "LBP", SA: "SAR", AE: "AED", QA: "QAR", KW: "KWD", BH: "BHD", OM: "OMR", JO: "JOD",
  ZA: "ZAR", NA: "NAD", BW: "BWP", KE: "KES", TZ: "TZS", UG: "UGX", NG: "NGN",
  US: "USD", GB: "GBP", CA: "CAD", AU: "AUD", NZ: "NZD", CH: "CHF",
  BR: "BRL", MX: "MXN", AR: "ARS", CL: "CLP", CO: "COP",
  CN: "CNY", TW: "TWD", HK: "HKD", SG: "SGD", TH: "THB", VN: "VND", PH: "PHP",
};
