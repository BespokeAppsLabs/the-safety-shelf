import { expect, test } from "vitest";
import { api } from "../../../_generated/api";
import { setupTest, seedOwner, seedCustomer, seedLiveBook, userIdFor } from "../../../../test/helpers";

test("owner revokes an entitlement and marks the order refunded", async () => {
  const t = setupTest();
  const asOwner = await seedOwner(t);
  const asCustomer = await seedCustomer(t);
  const userId = (await userIdFor(t, "clerk_customer"))!._id;
  const bookId = await seedLiveBook(t);
  await asOwner.mutation(api.entitlements.grant, { userId, bookId });

  await asOwner.mutation(api.entitlements.revoke, { userId, bookId });

  expect(await asCustomer.query(api.entitlements.isOwned, { bookId })).toBe(false);
  const orders = await t.run((ctx) => ctx.db.query("orders").collect());
  expect(orders[0].status).toBe("refunded");
});

test("rejects revoking a non-existent entitlement", async () => {
  const t = setupTest();
  const asOwner = await seedOwner(t);
  await seedCustomer(t);
  const userId = (await userIdFor(t, "clerk_customer"))!._id;
  const bookId = await seedLiveBook(t);

  await expect(asOwner.mutation(api.entitlements.revoke, { userId, bookId })).rejects.toThrow();
});

test("rejects a non-owner", async () => {
  const t = setupTest();
  const asOwner = await seedOwner(t);
  const asCustomer = await seedCustomer(t);
  const userId = (await userIdFor(t, "clerk_customer"))!._id;
  const bookId = await seedLiveBook(t);
  await asOwner.mutation(api.entitlements.grant, { userId, bookId });

  await expect(asCustomer.mutation(api.entitlements.revoke, { userId, bookId })).rejects.toThrow();
});
