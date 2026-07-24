// Rows written before translation review existed have no flag and remain
// readable. Only newly generated, explicitly false rows wait for approval.
export function isSavedTranslation(variant: { isSaved?: boolean }) {
  return variant.isSaved !== false;
}
