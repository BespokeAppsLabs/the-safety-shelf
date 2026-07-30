import { expect, test } from "vitest";
import { api, internal } from "../_generated/api";
import { setupTest } from "../../test/helpers";

test("demo seed restores all seven books and can attach a cover", async () => {
  const t = setupTest();

  expect(await t.mutation(internal.seed.seed, {})).toBe("seeded");
  expect(await t.mutation(internal.seed.seed, {})).toBe("already seeded");

  const books = await t.query(api.books.listLive, {});
  expect(books.map((book) => book.slug)).toEqual([
    "pregnancy-safety-basics",
    "newborn-home-readiness",
    "first-aid-quick-guide",
    "home-emergency-prep",
    "food-and-hygiene-routines",
    "workplace-safety-startup-kit",
    "safe-travels-a-toddler-s-car-safety-guide",
  ]);

  const storageId = await t.run((ctx) => ctx.storage.store(new Blob(["cover"], { type: "image/webp" })));
  await t.mutation(internal.seed.attachCover, { slug: books[0].slug, storageId });
  expect((await t.run((ctx) => ctx.db.get(books[0]._id)))?.coverStorageId).toBe(storageId);
});
