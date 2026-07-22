import { expect, test } from "vitest";
import { api } from "../../../_generated/api";
import { setupTest, seedOwner, seedCustomer, seedCategory } from "../../../../test/helpers";

async function seedBook(t: ReturnType<typeof setupTest>) {
  const categoryId = await seedCategory(t);
  return t.run((ctx) =>
    ctx.db.insert("books", {
      slug: "first-aid-quick-guide",
      title: "First Aid Quick Guide",
      author: "Nomsa Pillay",
      priceCents: 999,
      status: "draft",
      categoryId,
      ageGroup: "All ages",
      originalLang: "en",
      blurb: "A fast-reference primer.",
    }),
  );
}

test("owner publishes a draft to live", async () => {
  const t = setupTest();
  const asOwner = await seedOwner(t);
  const bookId = await seedBook(t);

  await asOwner.mutation(api.books.setStatus, { bookId, status: "live" });

  const book = await t.run((ctx) => ctx.db.get(bookId));
  expect(book?.status).toBe("live");
});

test("rejects a non-owner", async () => {
  const t = setupTest();
  const asCustomer = await seedCustomer(t);
  const bookId = await seedBook(t);

  await expect(
    asCustomer.mutation(api.books.setStatus, { bookId, status: "live" }),
  ).rejects.toThrow();
});

test("rejects an unknown bookId", async () => {
  const t = setupTest();
  const asOwner = await seedOwner(t);
  const bookId = await seedBook(t);
  await t.run((ctx) => ctx.db.delete(bookId));

  await expect(
    asOwner.mutation(api.books.setStatus, { bookId, status: "live" }),
  ).rejects.toThrow();
});
