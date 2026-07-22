import { expect, test } from "vitest";
import { api } from "../../../_generated/api";
import { setupTest, seedOwner, seedCustomer, seedCategory } from "../../../../test/helpers";

test("owner sees books of every status", async () => {
  const t = setupTest();
  const asOwner = await seedOwner(t);
  const categoryId = await seedCategory(t);
  const base = { author: "Author", priceCents: 999, categoryId, ageGroup: "All ages", originalLang: "en", blurb: "Blurb" };

  await t.run((ctx) => ctx.db.insert("books", { ...base, slug: "draft-one", title: "Draft One", status: "draft" }));
  await t.run((ctx) => ctx.db.insert("books", { ...base, slug: "live-one", title: "Live One", status: "live" }));

  const rows = await asOwner.query(api.books.listAll, {});
  expect(rows).toHaveLength(2);
});

test("rejects a non-owner", async () => {
  const t = setupTest();
  const asCustomer = await seedCustomer(t);

  await expect(asCustomer.query(api.books.listAll, {})).rejects.toThrow();
});
