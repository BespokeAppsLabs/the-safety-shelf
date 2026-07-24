import { expect, test } from "vitest";
import { internal } from "../_generated/api";
import { setupTest, seedLiveBook } from "../../test/helpers";

test("generated cover storage is attached to the book", async () => {
  const t = setupTest();
  const bookId = await seedLiveBook(t);
  const storageId = await t.run((ctx) => ctx.storage.store(new Blob(["cover-bytes"], { type: "image/webp" })));

  await t.mutation(internal.imageMutations.setCover, { bookId, storageId });

  expect((await t.run((ctx) => ctx.db.get(bookId)))?.coverStorageId).toBe(storageId);
});
