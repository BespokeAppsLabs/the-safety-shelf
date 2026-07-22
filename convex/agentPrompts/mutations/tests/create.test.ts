import { expect, test } from "vitest";
import { api } from "../../../_generated/api";
import { setupTest, seedOwner, seedCustomer } from "../../../../test/helpers";

test("owner publishes the first version as active", async () => {
  const t = setupTest();
  const asOwner = await seedOwner(t);

  const id = await asOwner.mutation(api.agentPrompts.create, { content: "You are the agent." });

  const row = await t.run((ctx) => ctx.db.get(id));
  expect(row?.version).toBe(1);
  expect(row?.isActive).toBe(true);
});

test("publishing a new version deactivates the previous one", async () => {
  const t = setupTest();
  const asOwner = await seedOwner(t);

  const firstId = await asOwner.mutation(api.agentPrompts.create, { content: "v1" });
  const secondId = await asOwner.mutation(api.agentPrompts.create, { content: "v2", note: "tightened voice" });

  const first = await t.run((ctx) => ctx.db.get(firstId));
  const second = await t.run((ctx) => ctx.db.get(secondId));
  expect(first?.isActive).toBe(false);
  expect(second?.isActive).toBe(true);
  expect(second?.version).toBe(2);
});

test("rejects empty content", async () => {
  const t = setupTest();
  const asOwner = await seedOwner(t);

  await expect(asOwner.mutation(api.agentPrompts.create, { content: "   " })).rejects.toThrow();
});

test("rejects a non-owner", async () => {
  const t = setupTest();
  const asCustomer = await seedCustomer(t);

  await expect(asCustomer.mutation(api.agentPrompts.create, { content: "v1" })).rejects.toThrow();
});
