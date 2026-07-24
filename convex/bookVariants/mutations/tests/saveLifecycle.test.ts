import { expect, test } from "vitest";
import { api } from "../../../_generated/api";
import { setupTest, seedLiveBook, seedOwner } from "../../../../test/helpers";

test("holds a new translation until the owner saves it", async () => {
  const t = setupTest();
  const asOwner = await seedOwner(t);
  const bookId = await seedLiveBook(t);

  const variantId = await asOwner.mutation(api.bookVariants.create, { bookId, lang: "es" });
  expect((await t.run((ctx) => ctx.db.get(variantId)))?.isSaved).toBe(false);

  await asOwner.mutation(api.bookVariants.update, { variantId, isSaved: true });
  expect((await t.run((ctx) => ctx.db.get(variantId)))?.isSaved).toBe(true);
});
