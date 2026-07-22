import { expect, test } from "vitest";
import { blocksToChapters, chaptersToBlocks, chapterCharacters } from "../lib/bookContent";

test("blocks round-trip through chapters", () => {
  const blocks = [
    { chapter: 1, ord: 0, type: "h" as const, text: "Stay calm" },
    { chapter: 1, ord: 1, type: "p" as const, text: "Assess the airway." },
    { chapter: 1, ord: 2, type: "p" as const, text: "Call for help." },
    { chapter: 2, ord: 0, type: "h" as const, text: "After" },
    { chapter: 2, ord: 1, type: "p" as const, text: "Monitor breathing." },
  ];
  const chapters = blocksToChapters(blocks);
  expect(chapters).toEqual([
    { heading: "Stay calm", body: "Assess the airway.\n\nCall for help." },
    { heading: "After", body: "Monitor breathing." },
  ]);
  expect(chaptersToBlocks(chapters)).toEqual(blocks);
});

test("chaptersToBlocks renumbers chapters and splits paragraphs on blank lines", () => {
  const blocks = chaptersToBlocks([{ heading: "H", body: "one\n\n\n  two  " }]);
  expect(blocks).toEqual([
    { chapter: 1, ord: 0, type: "h", text: "H" },
    { chapter: 1, ord: 1, type: "p", text: "one" },
    { chapter: 1, ord: 2, type: "p", text: "two" },
  ]);
});

test("chapterCharacters totals heading + body length", () => {
  expect(chapterCharacters([{ heading: "ab", body: "cde" }])).toBe(5);
});
