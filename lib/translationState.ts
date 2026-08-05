// Rows written before translation review existed have no flag and remain
// readable. Only newly generated, explicitly false rows wait for approval.
export function isSavedTranslation(variant: { isSaved?: boolean }) {
  return variant.isSaved !== false;
}

export function translationReviewState(
  variants: readonly { _id: string; isSaved?: boolean }[] | undefined,
  variantId: string,
) {
  if (variants === undefined) return "loading" as const;
  const variant = variants.find((item) => item._id === variantId);
  if (!variant) return "discarded" as const;
  return isSavedTranslation(variant) ? "saved" as const : "draft" as const;
}
