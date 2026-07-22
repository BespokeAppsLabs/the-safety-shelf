import { expect, test } from "vitest";
import { api } from "../../../_generated/api";
import { setupTest, seedOwner, seedCustomer, seedCategory } from "../../../../test/helpers";

async function bookArgs(t: ReturnType<typeof setupTest>, overrides = {}) {
  const categoryId = await seedCategory(t);
  return {
    slug: "first-aid-quick-guide",
    title: "First Aid Quick Guide",
    author: "Nomsa Pillay",
    priceCents: 999,
    categoryId,
    ageGroup: "All ages",
    originalLang: "en",
    blurb: "A fast-reference primer.",
    ...overrides,
  };
}

test("owner creates a book as a draft", async () => {
  const t = setupTest();
  const asOwner = await seedOwner(t);

  const id = await asOwner.mutation(api.books.create, await bookArgs(t));

  const book = await t.run((ctx) => ctx.db.get(id));
  expect(book?.status).toBe("draft");
});

test("rejects a non-owner", async () => {
  const t = setupTest();
  const asCustomer = await seedCustomer(t);

  await expect(asCustomer.mutation(api.books.create, await bookArgs(t))).rejects.toThrow();
});

test("rejects a duplicate slug", async () => {
  const t = setupTest();
  const asOwner = await seedOwner(t);
  const args = await bookArgs(t);

  await asOwner.mutation(api.books.create, args);
  await expect(asOwner.mutation(api.books.create, args)).rejects.toThrow();
});

test("rejects a non-positive price", async () => {
  const t = setupTest();
  const asOwner = await seedOwner(t);

  await expect(
    asOwner.mutation(api.books.create, await bookArgs(t, { priceCents: 0 })),
  ).rejects.toThrow();
});

test("rejects an unknown categoryId", async () => {
  const t = setupTest();
  const asOwner = await seedOwner(t);
  const fakeCategoryId = await t.run(async (ctx) => {
    const id = await ctx.db.insert("categories", { slug: "temp", title: "Temp", sortOrder: 0 });
    await ctx.db.delete(id);
    return id;
  });

  await expect(
    asOwner.mutation(api.books.create, await bookArgs(t, { categoryId: fakeCategoryId })),
  ).rejects.toThrow();
});
