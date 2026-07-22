import { expect, test } from "vitest";
import { api } from "../../../_generated/api";
import { setupTest, seedCategory } from "../../../../test/helpers";

test("returns an empty list for a book with no blocks", async () => {
  const t = setupTest();
  const categoryId = await seedCategory(t);
  const bookId = await t.run((ctx) =>
    ctx.db.insert("books", {
      slug: "empty-book", title: "Empty Book", author: "Author", priceCents: 999,
      status: "draft", categoryId, ageGroup: "All ages", originalLang: "en", blurb: "Blurb",
    }),
  );

  expect(await t.query(api.bookBlocks.listByBook, { bookId })).toEqual([]);
});
