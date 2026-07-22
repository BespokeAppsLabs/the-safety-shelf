import { expect, test } from "vitest";
import { api } from "../../../_generated/api";
import { setupTest, seedOwner, seedCustomer } from "../../../../test/helpers";

test("owner approves a proposed action", async () => {
  const t = setupTest();
  const asOwner = await seedOwner(t);
  const actionId = await asOwner.mutation(api.agentActions.propose, { tool: "writeBook", args: {} });

  await asOwner.mutation(api.agentActions.decide, { actionId, decision: "approved" });

  const action = await t.run((ctx) => ctx.db.get(actionId));
  expect(action?.status).toBe("approved");
  expect(action?.decidedBy).toBeDefined();
});

test("rejects deciding an action twice", async () => {
  const t = setupTest();
  const asOwner = await seedOwner(t);
  const actionId = await asOwner.mutation(api.agentActions.propose, { tool: "writeBook", args: {} });

  await asOwner.mutation(api.agentActions.decide, { actionId, decision: "rejected" });
  await expect(
    asOwner.mutation(api.agentActions.decide, { actionId, decision: "approved" }),
  ).rejects.toThrow();
});

test("rejects a non-owner", async () => {
  const t = setupTest();
  const asOwner = await seedOwner(t);
  const asCustomer = await seedCustomer(t);
  const actionId = await asOwner.mutation(api.agentActions.propose, { tool: "writeBook", args: {} });

  await expect(
    asCustomer.mutation(api.agentActions.decide, { actionId, decision: "approved" }),
  ).rejects.toThrow();
});
