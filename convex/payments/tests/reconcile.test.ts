import { expect, test } from "vitest";
import { api, internal } from "../../_generated/api";
import {
  setupTest,
  seedCustomer,
  seedLiveBook,
  seedOwner,
  seedStoreSettings,
  userIdFor,
} from "../../../test/helpers";

// The money path. Everything here guards a rule that, if it broke, would give
// away a book for free or charge for one twice.

async function arrange(priceCents = 1500) {
  const t = setupTest();
  await seedStoreSettings(t, "ZAR");
  const asCustomer = await seedCustomer(t);
  const bookId = await seedLiveBook(t, { priceCents });
  const user = await userIdFor(t, "clerk_customer");
  const reference = "TSS-test-reference";
  await asCustomer.mutation(internal.payments.createPendingOrder, { bookId, reference });
  return { t, asCustomer, bookId, userId: user!._id, reference, priceCents };
}

const owns = (t: ReturnType<typeof setupTest>, userId: string, bookId: string) =>
  t.run(async (ctx) => {
    const rows = await ctx.db.query("entitlements").collect();
    return rows.filter((e) => e.userId === userId && e.bookId === bookId && !e.revokedAt).length;
  });

const orderFor = (t: ReturnType<typeof setupTest>, reference: string) =>
  t.run(async (ctx) => {
    const order = await ctx.db
      .query("orders")
      .withIndex("by_reference", (q) => q.eq("reference", reference))
      .unique();
    return order!;
  });

test("a pending order grants nothing until the gateway confirms", async () => {
  const { t, userId, bookId, reference } = await arrange();

  expect((await orderFor(t, reference)).status).toBe("pending");
  expect(await owns(t, userId, bookId)).toBe(0);
});

test("charge.success flips the order to paid and grants the entitlement", async () => {
  const { t, userId, bookId, reference, priceCents } = await arrange();

  const result = await t.mutation(internal.payments.reconcile, {
    reference,
    outcome: "success",
    amount: priceCents,
    currency: "ZAR",
    providerTransactionId: "9876",
  });

  expect(result.status).toBe("paid");
  const order = await orderFor(t, reference);
  expect(order.status).toBe("paid");
  expect(order.providerTransactionId).toBe("9876");
  expect(await owns(t, userId, bookId)).toBe(1);
});

test("a replayed webhook does not grant or bill twice", async () => {
  const { t, userId, bookId, reference, priceCents } = await arrange();
  const args = { reference, outcome: "success" as const, amount: priceCents, currency: "ZAR" };

  await t.mutation(internal.payments.reconcile, args);
  const replay = await t.mutation(internal.payments.reconcile, args);

  expect(replay.status).toBe("already_paid");
  expect(await owns(t, userId, bookId)).toBe(1);
  const items = await t.run((ctx) => ctx.db.query("orderItems").collect());
  expect(items).toHaveLength(1);
});

test("refuses to grant when the paid amount disagrees with the order", async () => {
  const { t, userId, bookId, reference, priceCents } = await arrange();

  const result = await t.mutation(internal.payments.reconcile, {
    reference,
    outcome: "success",
    amount: priceCents - 1400,
    currency: "ZAR",
  });

  expect(result.status).toBe("amount_mismatch");
  expect((await orderFor(t, reference)).status).toBe("pending");
  expect(await owns(t, userId, bookId)).toBe(0);
});

test("refuses to grant when the paid currency disagrees with the order", async () => {
  const { t, userId, bookId, reference, priceCents } = await arrange();

  const result = await t.mutation(internal.payments.reconcile, {
    reference,
    outcome: "success",
    amount: priceCents,
    currency: "NGN",
  });

  expect(result.status).toBe("currency_mismatch");
  expect(await owns(t, userId, bookId)).toBe(0);
});

test("a declined charge records the reason and grants nothing", async () => {
  const { t, userId, bookId, reference } = await arrange();

  await t.mutation(internal.payments.reconcile, {
    reference,
    outcome: "failed",
    failureReason: "Insufficient funds",
  });

  const order = await orderFor(t, reference);
  expect(order.status).toBe("pending");
  expect(order.failureReason).toBe("Insufficient funds");
  expect(await owns(t, userId, bookId)).toBe(0);
});

test("a reference we never issued is ignored", async () => {
  const { t } = await arrange();
  const result = await t.mutation(internal.payments.reconcile, {
    reference: "TSS-never-issued",
    outcome: "success",
    amount: 100,
  });
  expect(result.status).toBe("unknown_reference");
});

test("a refund revokes access and marks the order refunded", async () => {
  const { t, userId, bookId, reference, priceCents } = await arrange();
  await t.mutation(internal.payments.reconcile, {
    reference,
    outcome: "success",
    amount: priceCents,
    currency: "ZAR",
  });

  await t.mutation(internal.payments.refund, { reference });

  expect((await orderFor(t, reference)).status).toBe("refunded");
  expect(await owns(t, userId, bookId)).toBe(0);
});

test("a refunded order cannot be reconciled back into a grant", async () => {
  const { t, userId, bookId, reference, priceCents } = await arrange();
  await t.mutation(internal.payments.reconcile, {
    reference,
    outcome: "success",
    amount: priceCents,
    currency: "ZAR",
  });
  await t.mutation(internal.payments.refund, { reference });

  const late = await t.mutation(internal.payments.reconcile, {
    reference,
    outcome: "success",
    amount: priceCents,
    currency: "ZAR",
  });

  expect(late.status).toBe("refunded");
  expect(await owns(t, userId, bookId)).toBe(0);
});

test("checkout is refused for a book the customer already owns", async () => {
  const { t, asCustomer, bookId, reference, priceCents } = await arrange();
  await t.mutation(internal.payments.reconcile, {
    reference,
    outcome: "success",
    amount: priceCents,
    currency: "ZAR",
  });

  await expect(
    asCustomer.mutation(internal.payments.createPendingOrder, { bookId, reference: "TSS-second" }),
  ).rejects.toThrow();
});

test("checkout is refused when the store has no base currency", async () => {
  const t = setupTest();
  const asCustomer = await seedCustomer(t);
  const bookId = await seedLiveBook(t, { priceCents: 1500 });
  // Charging an amount whose currency we cannot name is worse than not selling.
  await t.run(async (ctx) => {
    const settings = await ctx.db.query("storeSettings").first();
    if (settings) await ctx.db.delete(settings._id);
  });

  await expect(
    asCustomer.mutation(internal.payments.createPendingOrder, { bookId, reference: "TSS-x" }),
  ).rejects.toThrow();
});

test("pending and refunded orders are excluded from sales figures", async () => {
  const { t, bookId, reference, priceCents } = await arrange();
  const asOwner = await seedOwner(t);

  // Still pending — the shopper opened Paystack and walked away.
  expect(await asOwner.query(api.books.salesSummary, {})).toEqual({});

  await t.mutation(internal.payments.reconcile, {
    reference,
    outcome: "success",
    amount: priceCents,
    currency: "ZAR",
  });
  expect(await asOwner.query(api.books.salesSummary, {})).toEqual({
    [bookId]: { units: 1, revenueCents: priceCents },
  });

  await t.mutation(internal.payments.refund, { reference });
  expect(await asOwner.query(api.books.salesSummary, {})).toEqual({});
});
