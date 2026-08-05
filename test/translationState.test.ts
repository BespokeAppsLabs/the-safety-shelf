import { expect, test } from "vitest";
import { isSavedTranslation, translationReviewState } from "../lib/translationState";

test("keeps legacy translations readable while holding new drafts for review", () => {
  expect(isSavedTranslation({})).toBe(true);
  expect(isSavedTranslation({ isSaved: true })).toBe(true);
  expect(isSavedTranslation({ isSaved: false })).toBe(false);
});

test("derives translation card state from persisted variants after reload", () => {
  expect(translationReviewState(undefined, "variant-1")).toBe("loading");
  expect(translationReviewState([{ _id: "variant-1", isSaved: false }], "variant-1")).toBe("draft");
  expect(translationReviewState([{ _id: "variant-1", isSaved: true }], "variant-1")).toBe("saved");
  expect(translationReviewState([], "variant-1")).toBe("discarded");
});
