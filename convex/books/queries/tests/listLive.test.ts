import { expect, test } from "vitest";
import { api } from "../../../_generated/api";
import { setupTest, seedCategory } from "../../../../test/helpers";

test("only returns live books", async () => {
  const t = setupTest();
  const categoryId = await seedCategory(t);
  const base = {
    author: "Author",
    priceCents: 999,
    categoryId,
    ageGroup: "All ages",
    originalLang: "en",
    blurb: "Blurb",
  };

  await t.run((ctx) => ctx.db.insert("books", { ...base, slug: "draft-one", title: "Draft One", status: "draft" }));
  await t.run((ctx) => ctx.db.insert("books", { ...base, slug: "live-one", title: "Live One", status: "live" }));

  const rows = await t.query(api.books.listLive, {});
  expect(rows.map((r) => r.slug)).toEqual(["live-one"]);
});
