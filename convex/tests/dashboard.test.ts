import { expect, test } from "vitest";
import { api } from "../_generated/api";
import { seedCategory, seedCustomer, seedLiveBook, seedOwner, setupTest } from "../../test/helpers";

test("overview uses paid orders only and exposes live workflow counts", async () => {
  const t = setupTest();
  const owner = await seedOwner(t);
  const customer = await seedCustomer(t);
  const bookId = await seedLiveBook(t, { priceCents: 500 });
  const categoryId = await seedCategory(t, "draft-category");
  await t.run((ctx) => ctx.db.insert("books", { slug: "draft", title: "Draft", author: "Owner", priceCents: 100, status: "draft", categoryId, ageGroup: "All", originalLang: "en", blurb: "Draft." }));
  await customer.mutation(api.entitlements.demoPurchase, { bookId });
  await owner.mutation(api.agentActions.propose, { tool: "publishBook", args: {} });

  const overview = await owner.query(api.dashboard.overview, {});
  expect(overview).toMatchObject({ liveBooks: 1, revenueCents: 500, activeUnlocks: 1, pendingApprovals: 1 });
  expect(overview.queue.map((item) => item.title)).toContain("Draft");
});

test("pendingApprovals counts every proposal, not just the recent slice", async () => {
  const t = setupTest();
  const owner = await seedOwner(t);
  // The queue panel shows 6 actions. Deriving the count from that slice caps it
  // at 6 — this is the 7th.
  for (let i = 0; i < 7; i += 1) {
    await owner.mutation(api.agentActions.propose, { tool: `publishBook${i}`, args: {} });
  }

  const overview = await owner.query(api.dashboard.overview, {});
  expect(overview.pendingApprovals).toBe(7);
  expect(overview.queue.length).toBeLessThanOrEqual(6);
});

test("overview rejects customers", async () => {
  const t = setupTest();
  const customer = await seedCustomer(t);
  await expect(customer.query(api.dashboard.overview, {})).rejects.toThrow();
});
