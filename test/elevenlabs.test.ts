import { expect, test } from "vitest";
import { planNarration, chapterNarration } from "../lib/elevenlabs";

test("plans one segment per non-empty chapter", () => {
  const plan = planNarration(
    [
      { heading: "Intro", body: "First para.\n\nSecond para." },
      { heading: "", body: "" },
      { heading: "End", body: "Wrap up." },
    ],
    "eleven_multilingual_v2",
  );
  expect(plan.ok).toBe(true);
  if (plan.ok) {
    expect(plan.segments.map((s) => s.chapter)).toEqual([1, 3]);
    expect(plan.segments[0].text).toBe(chapterNarration("Intro", "First para.\n\nSecond para."));
  }
});

test("rejects a chapter over the model's per-request limit", () => {
  const big = "a".repeat(5_001);
  const plan = planNarration([{ heading: "Big", body: big }], "eleven_v3"); // limit 5,000
  expect(plan.ok).toBe(false);
  if (!plan.ok) expect(plan.error).toMatch(/over the .*limit for eleven_v3/);
});

test("empty book has nothing to narrate", () => {
  const plan = planNarration([{ heading: "", body: "" }], "eleven_flash_v2_5");
  expect(plan.ok).toBe(false);
});
