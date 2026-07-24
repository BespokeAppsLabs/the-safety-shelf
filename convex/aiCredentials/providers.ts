export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
// Do not add a paid fallback: an account with zero credits must never route
// into a billable text model.
export const OPENROUTER_TEXT_MODEL = "google/gemma-4-26b-a4b-it:free";
export const OPENROUTER_TEXT_FALLBACKS = [] as const;
export const OPENROUTER_IMAGE_MODEL = "google/gemini-3.1-flash-lite-image";
