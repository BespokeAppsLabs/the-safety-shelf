import { expect, test } from "vitest";
import { api, internal } from "../../../_generated/api";
import { setupTest, seedOwner } from "../../../../test/helpers";

test("returns categories sorted by sortOrder", async () => {
  const t = setupTest();
  const asOwner = await seedOwner(t);

  await asOwner.mutation(api.categories.create, { slug: "b", title: "B", sortOrder: 2 });
  await asOwner.mutation(api.categories.create, { slug: "a", title: "A", sortOrder: 1 });

  const rows = await t.query(api.categories.list, {});
  expect(rows.map((r) => r.slug)).toEqual(["a", "b"]);
});

test("returns an empty list when there are no categories", async () => {
  const t = setupTest();
  expect(await t.query(api.categories.list, {})).toEqual([]);
});

test("resolves an attached category image from storage", async () => {
  const t = setupTest();
  const asOwner = await seedOwner(t);
  await asOwner.mutation(api.categories.create, { slug: "road-safety", title: "Road Safety", sortOrder: 1 });
  const storageId = await t.run((ctx) => ctx.storage.store(new Blob(["image"], { type: "image/webp" })));

  await t.mutation(internal.categoryImages.attach, { slug: "road-safety", storageId });

  const [category] = await t.query(api.categories.list, {});
  expect(category.imageStorageId).toBe(storageId);
  expect(category.imageUrl).toMatch(/^https:\/\//);
});
