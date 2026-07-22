import { expect, test } from "vitest";
import { api } from "../../../_generated/api";
import { setupTest, seedOwner, seedCustomer, seedLiveBook, userIdFor } from "../../../../test/helpers";

test("owner grants a customer access, creating order/orderItem/entitlement", async () => {
  const t = setupTest();
  const asOwner = await seedOwner(t);
  await seedCustomer(t);
  const userId = (await userIdFor(t, "clerk_customer"))!._id;
  const bookId = await seedLiveBook(t);

  await asOwner.mutation(api.entitlements.grant, { userId, bookId });

  const orders = await t.run((ctx) => ctx.db.query("orders").collect());
  const orderItems = await t.run((ctx) => ctx.db.query("orderItems").collect());
  expect(orders).toHaveLength(1);
  expect(orderItems).toHaveLength(1);
  expect(orders[0].totalCents).toBe(999);
});

test("rejects granting the same book twice", async () => {
  const t = setupTest();
  const asOwner = await seedOwner(t);
  await seedCustomer(t);
  const userId = (await userIdFor(t, "clerk_customer"))!._id;
  const bookId = await seedLiveBook(t);

  await asOwner.mutation(api.entitlements.grant, { userId, bookId });
  await expect(asOwner.mutation(api.entitlements.grant, { userId, bookId })).rejects.toThrow();
});

test("rejects a non-owner", async () => {
  const t = setupTest();
  const asCustomer = await seedCustomer(t);
  const userId = (await userIdFor(t, "clerk_customer"))!._id;
  const bookId = await seedLiveBook(t);

  await expect(asCustomer.mutation(api.entitlements.grant, { userId, bookId })).rejects.toThrow();
});

test("rejects granting a non-live book", async () => {
  const t = setupTest();
  const asOwner = await seedOwner(t);
  await seedCustomer(t);
  const userId = (await userIdFor(t, "clerk_customer"))!._id;
  const bookId = await seedLiveBook(t);
  await t.run((ctx) => ctx.db.patch(bookId, { status: "draft" }));

  await expect(asOwner.mutation(api.entitlements.grant, { userId, bookId })).rejects.toThrow();
});

test("re-grants after a revoke", async () => {
  const t = setupTest();
  const asOwner = await seedOwner(t);
  const asCustomer = await seedCustomer(t);
  const userId = (await userIdFor(t, "clerk_customer"))!._id;
  const bookId = await seedLiveBook(t);

  await asOwner.mutation(api.entitlements.grant, { userId, bookId });
  await asOwner.mutation(api.entitlements.revoke, { userId, bookId });
  await asOwner.mutation(api.entitlements.grant, { userId, bookId });

  expect(await asCustomer.query(api.entitlements.isOwned, { bookId })).toBe(true);
});
