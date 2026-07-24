import { expect, test } from "vitest";
import { splitParagraphs } from "../convex/translate";

test("keeps translation paragraph boundaries", () => {
  expect(splitParagraphs("First paragraph.\n\nSecond paragraph.\n \nThird paragraph.")).toEqual([
    "First paragraph.",
    "Second paragraph.",
    "Third paragraph.",
  ]);
});
