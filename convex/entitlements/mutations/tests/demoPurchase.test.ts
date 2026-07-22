import { expect, test } from "vitest";
import { api } from "../../../_generated/api";
import { setupTest, seedCustomer, seedLiveBook } from "../../../../test/helpers";

test("customer self-serves a purchase", async () => {
  const t = setupTest();
  const asCustomer = await seedCustomer(t);
  const bookId = await seedLiveBook(t);

  await asCustomer.mutation(api.entitlements.demoPurchase, { bookId });

  expect(await asCustomer.query(api.entitlements.isOwned, { bookId })).toBe(true);
});

test("rejects buying a book already owned", async () => {
  const t = setupTest();
  const asCustomer = await seedCustomer(t);
  const bookId = await seedLiveBook(t);

  await asCustomer.mutation(api.entitlements.demoPurchase, { bookId });
  await expect(asCustomer.mutation(api.entitlements.demoPurchase, { bookId })).rejects.toThrow();
});

test("rejects buying a non-live book", async () => {
  const t = setupTest();
  const asCustomer = await seedCustomer(t);
  const bookId = await seedLiveBook(t);
  await t.run((ctx) => ctx.db.patch(bookId, { status: "draft" }));

  await expect(asCustomer.mutation(api.entitlements.demoPurchase, { bookId })).rejects.toThrow();
});

test("rejects when signed out", async () => {
  const t = setupTest();
  const bookId = await seedLiveBook(t);

  await expect(t.mutation(api.entitlements.demoPurchase, { bookId })).rejects.toThrow();
});
