import { expect, test } from "vitest";
import { api } from "../../../_generated/api";
import { setupTest, seedOwner, seedLiveBook } from "../../../../test/helpers";

async function seedDraftTranslation(t: ReturnType<typeof setupTest>, asOwner: Awaited<ReturnType<typeof seedOwner>>) {
  const bookId = await seedLiveBook(t);
  const variantId = await asOwner.mutation(api.bookVariants.create, {
    bookId, lang: "af", title: "Noodhulp", blurb: "Kort gids.",
  });
  await asOwner.mutation(api.variantBlocks.setBlocks, {
    variantId,
    blocks: [
      { chapter: 1, ord: 0, type: "h" as const, text: "Hoofstuk een" },
      { chapter: 1, ord: 1, type: "p" as const, text: "Een paragraaf." },
    ],
  });
  return { bookId, variantId };
}

test("discarding a draft removes the variant and its blocks, unblocking the book", async () => {
  // The dead end this closes: translate.ts refuses to generate while any
  // variant on the book is unsaved, and nothing could remove one — so a bad
  // translation blocked that book permanently and the only exit was to save
  // it.
  const t = setupTest();
  const asOwner = await seedOwner(t);
  const { bookId, variantId } = await seedDraftTranslation(t, asOwner);

  expect(await asOwner.mutation(api.bookVariants.discard, { variantId })).toMatchObject({ discarded: true, lang: "af" });

  expect(await asOwner.query(api.bookVariants.list, { bookId })).toHaveLength(0);
  expect(await t.run((ctx) => ctx.db.query("variantBlocks").collect())).toHaveLength(0);
});

test("refuses to discard a saved translation", async () => {
  // Removing reviewed admin content is a different decision from throwing away
  // a draft, and must not happen behind a button
  // labelled "discard".
  const t = setupTest();
  const asOwner = await seedOwner(t);
  const { variantId } = await seedDraftTranslation(t, asOwner);
  await asOwner.mutation(api.bookVariants.update, { variantId, isSaved: true });

  await expect(asOwner.mutation(api.bookVariants.discard, { variantId })).rejects.toThrow(/saved/);
  expect(await t.run((ctx) => ctx.db.get(variantId))).not.toBeNull();
});

test("rejects discarding as a non-owner", async () => {
  const t = setupTest();
  const asOwner = await seedOwner(t);
  const asCustomer = await (await import("../../../../test/helpers")).seedCustomer(t);
  const { variantId } = await seedDraftTranslation(t, asOwner);

  await expect(asCustomer.mutation(api.bookVariants.discard, { variantId })).rejects.toThrow();
});
