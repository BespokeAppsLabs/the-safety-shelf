import { expect, test } from "vitest";
import { api } from "../../../_generated/api";
import { setupTest, seedOwner, seedCustomer, seedCategory } from "../../../../test/helpers";

async function seedBook(t: ReturnType<typeof setupTest>) {
  const categoryId = await seedCategory(t);
  return t.run((ctx) =>
    ctx.db.insert("books", {
      slug: "first-aid-quick-guide", title: "First Aid Quick Guide", author: "Nomsa Pillay",
      priceCents: 999, status: "draft", categoryId, ageGroup: "All ages", originalLang: "en",
      blurb: "A fast-reference primer.",
    }),
  );
}

test("owner sets blocks for a book", async () => {
  const t = setupTest();
  const asOwner = await seedOwner(t);
  const bookId = await seedBook(t);

  await asOwner.mutation(api.bookBlocks.setBlocks, {
    bookId,
    blocks: [
      { chapter: 1, ord: 0, type: "h", text: "Chapter One" },
      { chapter: 1, ord: 1, type: "p", text: "Stay calm." },
    ],
  });

  const rows = await t.query(api.bookBlocks.listByBook, { bookId });
  expect(rows).toHaveLength(2);
});

test("replaces existing blocks rather than appending", async () => {
  const t = setupTest();
  const asOwner = await seedOwner(t);
  const bookId = await seedBook(t);

  await asOwner.mutation(api.bookBlocks.setBlocks, {
    bookId,
    blocks: [{ chapter: 1, ord: 0, type: "p", text: "First version" }],
  });
  await asOwner.mutation(api.bookBlocks.setBlocks, {
    bookId,
    blocks: [{ chapter: 1, ord: 0, type: "p", text: "Second version" }],
  });

  const rows = await t.query(api.bookBlocks.listByBook, { bookId });
  expect(rows).toHaveLength(1);
  expect(rows[0].text).toBe("Second version");
});

test("rejects a non-owner", async () => {
  const t = setupTest();
  const asCustomer = await seedCustomer(t);
  const bookId = await seedBook(t);

  await expect(
    asCustomer.mutation(api.bookBlocks.setBlocks, {
      bookId,
      blocks: [{ chapter: 1, ord: 0, type: "p", text: "Text" }],
    }),
  ).rejects.toThrow();
});

test("rejects a text block with no text", async () => {
  const t = setupTest();
  const asOwner = await seedOwner(t);
  const bookId = await seedBook(t);

  await expect(
    asOwner.mutation(api.bookBlocks.setBlocks, {
      bookId,
      blocks: [{ chapter: 1, ord: 0, type: "p" }],
    }),
  ).rejects.toThrow();
});

test("rejects an img block with no imgStorageId", async () => {
  const t = setupTest();
  const asOwner = await seedOwner(t);
  const bookId = await seedBook(t);

  await expect(
    asOwner.mutation(api.bookBlocks.setBlocks, {
      bookId,
      blocks: [{ chapter: 1, ord: 0, type: "img" }],
    }),
  ).rejects.toThrow();
});
