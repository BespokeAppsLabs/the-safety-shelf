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
    currency: "ZAR",
  });
  expect(result.status).toBe("unknown_reference");
});

test("a success payload missing amount or currency is refused, not waved through", async () => {
  const { t, userId, bookId, reference } = await arrange();

  const result = await t.mutation(internal.payments.reconcile, { reference, outcome: "success" });

  expect(result.status).toBe("verification_missing");
  expect((await orderFor(t, reference)).status).toBe("pending");
  expect(await owns(t, userId, bookId)).toBe(0);
});

test("a second checkout for the same book never creates a second transaction", async () => {
  const { t, asCustomer, bookId } = await arrange();

  // The first order has no authorizationUrl attached yet, so a rival tab is
  // told to wait rather than being allowed to initialize.
  const second = await asCustomer.mutation(internal.payments.createPendingOrder, {
    bookId,
    reference: "TSS-rival",
  });
  expect(second.mode).toBe("preparing");

  const orders = await t.run((ctx) => ctx.db.query("orders").collect());
  expect(orders).toHaveLength(1);
});

test("once the checkout URL exists, a second attempt resumes it instead of rivalling", async () => {
  const { t, asCustomer, bookId, reference } = await arrange();
  await asCustomer.mutation(internal.payments.attachAuthorizationUrl, {
    reference,
    authorizationUrl: "https://checkout.paystack.com/live-session",
  });

  const second = await asCustomer.mutation(internal.payments.createPendingOrder, {
    bookId,
    reference: "TSS-rival",
  });

  expect(second).toMatchObject({
    mode: "resume",
    reference,
    authorizationUrl: "https://checkout.paystack.com/live-session",
  });
  expect(await t.run((ctx) => ctx.db.query("orders").collect())).toHaveLength(1);
});

test("a retired checkout releases the lock so the customer can buy again", async () => {
  const { t, asCustomer, bookId, reference } = await arrange();

  await asCustomer.mutation(internal.payments.abandonOrder, { reference, reason: "verified_failed" });

  expect((await orderFor(t, reference)).status).toBe("abandoned");
  const fresh = await asCustomer.mutation(internal.payments.createPendingOrder, {
    bookId,
    reference: "TSS-fresh",
  });
  expect(fresh.mode).toBe("created");
});

test("abandonOrder cannot retire an order that already settled", async () => {
  const { t, asCustomer, reference, priceCents } = await arrange();
  await t.mutation(internal.payments.reconcile, {
    reference,
    outcome: "success",
    amount: priceCents,
    currency: "ZAR",
  });

  await asCustomer.mutation(internal.payments.abandonOrder, { reference, reason: "initialize_failed" });

  expect((await orderFor(t, reference)).status).toBe("paid");
});

test("a duplicate settlement is flagged for an operator instead of granted silently", async () => {
  const { t, asCustomer, userId, bookId, reference, priceCents } = await arrange();
  await t.mutation(internal.payments.reconcile, {
    reference,
    outcome: "success",
    amount: priceCents,
    currency: "ZAR",
  });
  // Force the state the prevention gate exists to stop, to prove the last line
  // of defence holds if it is ever bypassed.
  await asCustomer.mutation(internal.payments.abandonOrder, { reference: "none", reason: "x" });
  const secondOrderId = await t.run(async (ctx) => {
    const id = await ctx.db.insert("orders", {
      userId,
      reference: "TSS-duplicate",
      totalCents: priceCents,
      currency: "ZAR",
      status: "pending" as const,
    });
    await ctx.db.insert("orderItems", { orderId: id, bookId, priceCents });
    return id;
  });

  const result = await t.mutation(internal.payments.reconcile, {
    reference: "TSS-duplicate",
    outcome: "success",
    amount: priceCents,
    currency: "ZAR",
  });

  expect(result.status).toBe("duplicate_purchase");
  const dupe = await t.run((ctx) => ctx.db.get(secondOrderId));
  // Recorded as paid because the money really did move — losing that would
  // hide the very charge the operator has to refund.
  expect(dupe!.status).toBe("paid");
  expect(dupe!.failureReason).toBe("duplicate_purchase");
  expect(await owns(t, userId, bookId)).toBe(1);
});

test("flagged payments reach the owner instead of dying in a log", async () => {
  const { t, userId, bookId, reference, priceCents } = await arrange();
  const asOwner = await seedOwner(t);
  await t.mutation(internal.payments.reconcile, {
    reference,
    outcome: "success",
    amount: priceCents + 1,
    currency: "ZAR",
  });

  const flagged = await asOwner.query(api.payments.needingAttention, {});
  expect(flagged).toHaveLength(1);
  expect(flagged[0]).toMatchObject({ reason: "amount_mismatch", reference });

  const overview = await asOwner.query(api.dashboard.overview, {});
  expect(overview.paymentsNeedingAttention).toBe(1);
  void userId;
  void bookId;
});

test("a taken-over checkout can never publish its URL to a shopper", async () => {
  // The dangerous interleaving: creator A inserts its order, a follower takes
  // it over after the grace period, and only THEN does Paystack answer A. A's
  // session is real and payable, so if A were allowed to publish, two payable
  // sessions would exist for one book.
  const { t, asCustomer, bookId, reference } = await arrange();

  await t.run(async (ctx) => {
    const order = await ctx.db
      .query("orders")
      .withIndex("by_reference", (q) => q.eq("reference", reference))
      .unique();
    await ctx.db.patch(order!._id, { status: "abandoned", failureReason: "initialize_incomplete" });
  });

  const published = await asCustomer.mutation(internal.payments.attachAuthorizationUrl, {
    reference,
    authorizationUrl: "https://checkout.paystack.com/late-session",
  });

  // Refused, and startCheckout turns that false into an error rather than
  // handing the live URL over.
  expect(published).toBe(false);
  expect((await orderFor(t, reference)).authorizationUrl).toBeUndefined();
});

test("resolving an alert keeps the reason on the record", async () => {
  const { t, reference, priceCents } = await arrange();
  const asOwner = await seedOwner(t);
  await t.mutation(internal.payments.reconcile, {
    reference,
    outcome: "success",
    amount: priceCents + 1,
    currency: "ZAR",
  });
  const order = await orderFor(t, reference);

  await asOwner.mutation(api.payments.resolveAlert, { orderId: order._id });

  expect(await asOwner.query(api.payments.needingAttention, {})).toHaveLength(0);
  const after = await orderFor(t, reference);
  // Dismissed from the inbox, but the record of what went wrong survives.
  expect(after.failureReason).toBe("amount_mismatch");
  expect(after.alertResolvedAt).toBeTypeOf("number");
});

test("a refund closes the alert without erasing why it was raised", async () => {
  const { t, reference, priceCents } = await arrange();
  const asOwner = await seedOwner(t);
  await t.mutation(internal.payments.reconcile, {
    reference,
    outcome: "success",
    amount: priceCents,
    currency: "ZAR",
  });
  await t.run(async (ctx) => {
    const order = await ctx.db
      .query("orders")
      .withIndex("by_reference", (q) => q.eq("reference", reference))
      .unique();
    await ctx.db.patch(order!._id, { failureReason: "duplicate_purchase" });
  });

  await t.mutation(internal.payments.refund, { reference });

  expect(await asOwner.query(api.payments.needingAttention, {})).toHaveLength(0);
  expect((await orderFor(t, reference)).failureReason).toBe("duplicate_purchase");
});

test("owner comps grant access without counting as revenue", async () => {
  const t = setupTest();
  const asOwner = await seedOwner(t);
  await seedCustomer(t);
  const bookId = await seedLiveBook(t, { priceCents: 1500 });
  const userId = (await userIdFor(t, "clerk_customer"))!._id;

  await asOwner.mutation(api.entitlements.grant, { userId, bookId });

  expect(await owns(t, userId, bookId)).toBe(1);
  expect(await asOwner.query(api.books.salesSummary, {})).toEqual({});
  expect((await asOwner.query(api.dashboard.overview, {})).revenueCents).toBe(0);
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
