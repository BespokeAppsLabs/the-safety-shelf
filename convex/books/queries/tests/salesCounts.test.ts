import { expect, test } from "vitest";
import { api } from "../../../_generated/api";
import { setupTest, seedOwner, seedCustomer, seedLiveBook } from "../../../../test/helpers";

test("counts orderItems per book", async () => {
  const t = setupTest();
  const asOwner = await seedOwner(t);
  const asCustomer = await seedCustomer(t);
  const bookId = await seedLiveBook(t);

  await asCustomer.mutation(api.entitlements.demoPurchase, { bookId });

  const counts = await asOwner.query(api.books.salesCounts, {});
  expect(counts[bookId]).toBe(1);
});

test("rejects a non-owner", async () => {
  const t = setupTest();
  const asCustomer = await seedCustomer(t);
  await expect(asCustomer.query(api.books.salesCounts, {})).rejects.toThrow();
});
