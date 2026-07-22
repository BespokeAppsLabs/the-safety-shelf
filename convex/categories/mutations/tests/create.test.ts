import { expect, test } from "vitest";
import { api } from "../../../_generated/api";
import { setupTest, seedOwner, seedCustomer } from "../../../../test/helpers";

test("owner creates a category", async () => {
  const t = setupTest();
  const asOwner = await seedOwner(t);

  const id = await asOwner.mutation(api.categories.create, {
    slug: "workplace-safety",
    title: "Workplace Safety",
    icon: "🦺",
    sortOrder: 5,
  });

  const category = await t.run((ctx) => ctx.db.get(id));
  expect(category?.title).toBe("Workplace Safety");
});

test("rejects a duplicate slug", async () => {
  const t = setupTest();
  const asOwner = await seedOwner(t);

  await asOwner.mutation(api.categories.create, {
    slug: "first-aid",
    title: "First Aid",
    sortOrder: 1,
  });

  await expect(
    asOwner.mutation(api.categories.create, {
      slug: "first-aid",
      title: "First Aid Again",
      sortOrder: 2,
    }),
  ).rejects.toThrow();
});

test("rejects a non-owner", async () => {
  const t = setupTest();
  const asCustomer = await seedCustomer(t);

  await expect(
    asCustomer.mutation(api.categories.create, {
      slug: "home-safety",
      title: "Home Safety",
      sortOrder: 3,
    }),
  ).rejects.toThrow();
});
