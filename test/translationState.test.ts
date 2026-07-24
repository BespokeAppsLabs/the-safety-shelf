import { expect, test } from "vitest";
import { isSavedTranslation } from "../lib/translationState";

test("keeps legacy translations readable while holding new drafts for review", () => {
  expect(isSavedTranslation({})).toBe(true);
  expect(isSavedTranslation({ isSaved: true })).toBe(true);
  expect(isSavedTranslation({ isSaved: false })).toBe(false);
});
