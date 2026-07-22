import { expect, test } from "vitest";
import { api } from "../../../_generated/api";
import { setupTest, seedOwner, seedCustomer, seedLiveBook, userIdFor } from "../../../../test/helpers";

test("false when the viewer has no entitlement", async () => {
  const t = setupTest();
  const asCustomer = await seedCustomer(t);
  const bookId = await seedLiveBook(t);

  expect(await asCustomer.query(api.entitlements.isOwned, { bookId })).toBe(false);
});

test("true after a grant", async () => {
  const t = setupTest();
  const asOwner = await seedOwner(t);
  const asCustomer = await seedCustomer(t);
  const userId = (await userIdFor(t, "clerk_customer"))!._id;
  const bookId = await seedLiveBook(t);

  await asOwner.mutation(api.entitlements.grant, { userId, bookId });
  expect(await asCustomer.query(api.entitlements.isOwned, { bookId })).toBe(true);
});

test("rejects when signed out", async () => {
  const t = setupTest();
  const bookId = await seedLiveBook(t);
  await expect(t.query(api.entitlements.isOwned, { bookId })).rejects.toThrow();
});
