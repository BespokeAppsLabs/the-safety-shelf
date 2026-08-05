import { expect, test } from "vitest";
import { internal } from "../_generated/api";
import { setupTest } from "../../test/helpers";

test("bootstrap inserts the production taxonomy, is idempotent, and adds no books", async () => {
  const t = setupTest();

  const first = await t.mutation(internal.bootstrapCategories.bootstrapCategories, {});
  expect(first.created).toHaveLength(8);
  expect(first.skipped).toEqual([]);

  // Re-running must not duplicate — the whole point of the slug check.
  const second = await t.mutation(internal.bootstrapCategories.bootstrapCategories, {});
  expect(second.created).toEqual([]);
  expect(second.skipped).toHaveLength(8);

  const categories = await t.run((ctx) => ctx.db.query("categories").collect());
  expect(categories).toHaveLength(8);
  expect(categories.map((c) => c.slug).sort()).toEqual([
    "child-safety-at-home",
    "emotional-and-physical-abuse",
    "gender-based-violence",
    "mine-health-and-safety",
    "newborn-care",
    "pregnancy-and-disability-awareness",
    "pregnancy-care",
    "road-safety-for-children",
  ]);

  // Every category is storefront-ready: nothing ships with a blank blurb.
  expect(categories.every((c) => (c.description ?? "").length > 0)).toBe(true);

  // The requirement that matters: taxonomy only, never catalogue.
  expect(await t.run((ctx) => ctx.db.query("books").collect())).toEqual([]);
  expect(await t.run((ctx) => ctx.db.query("bookBlocks").collect())).toEqual([]);
});
