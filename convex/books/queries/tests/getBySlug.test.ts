import { expect, test } from "vitest";
import { api } from "../../../_generated/api";
import { setupTest, seedCategory } from "../../../../test/helpers";

test("returns a live book by slug", async () => {
  const t = setupTest();
  const categoryId = await seedCategory(t);
  await t.run((ctx) =>
    ctx.db.insert("books", {
      slug: "live-one", title: "Live One", author: "Author", priceCents: 999,
      status: "live", categoryId, ageGroup: "All ages", originalLang: "en", blurb: "Blurb",
    }),
  );

  const book = await t.query(api.books.getBySlug, { slug: "live-one" });
  expect(book?.title).toBe("Live One");
});

test("returns null for a draft book", async () => {
  const t = setupTest();
  const categoryId = await seedCategory(t);
  await t.run((ctx) =>
    ctx.db.insert("books", {
      slug: "draft-one", title: "Draft One", author: "Author", priceCents: 999,
      status: "draft", categoryId, ageGroup: "All ages", originalLang: "en", blurb: "Blurb",
    }),
  );

  expect(await t.query(api.books.getBySlug, { slug: "draft-one" })).toBeNull();
});

test("returns null for an unknown slug", async () => {
  const t = setupTest();
  expect(await t.query(api.books.getBySlug, { slug: "nope" })).toBeNull();
});
