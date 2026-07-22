import { expect, test } from "vitest";
import { api } from "../../../_generated/api";
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
