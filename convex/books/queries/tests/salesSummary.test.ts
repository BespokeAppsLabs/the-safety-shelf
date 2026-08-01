import { expect, test } from "vitest";
import { api } from "../../../_generated/api";
import { setupTest, seedOwner, seedCustomer, seedLiveBook, seedPurchase, userIdFor } from "../../../../test/helpers";

test("sums units and revenue from real orderItems", async () => {
  const t = setupTest();
  const asOwner = await seedOwner(t);
  await seedCustomer(t);
  const bookId = await seedLiveBook(t, { priceCents: 500 });

  const buyer = await userIdFor(t, "clerk_customer");
  await seedPurchase(t, { userId: buyer!._id, bookId, priceCents: 500 });

  const summary = await asOwner.query(api.books.salesSummary, {});
  expect(summary[bookId]).toEqual({ units: 1, revenueCents: 500 });
});

test("returns an empty object when nothing has sold", async () => {
  const t = setupTest();
  const asOwner = await seedOwner(t);
  expect(await asOwner.query(api.books.salesSummary, {})).toEqual({});
});

test("rejects a non-owner", async () => {
  const t = setupTest();
  const asCustomer = await seedCustomer(t);
  await expect(asCustomer.query(api.books.salesSummary, {})).rejects.toThrow();
});
