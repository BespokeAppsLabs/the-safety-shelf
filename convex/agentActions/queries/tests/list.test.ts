import { expect, test } from "vitest";
import { api } from "../../../_generated/api";
import { setupTest, seedOwner, seedCustomer } from "../../../../test/helpers";

test("owner lists all actions, optionally filtered by status", async () => {
  const t = setupTest();
  const asOwner = await seedOwner(t);
  const id1 = await asOwner.mutation(api.agentActions.propose, { tool: "writeBook", args: {} });
  await asOwner.mutation(api.agentActions.propose, { tool: "generateSocialPost", args: {} });
  await asOwner.mutation(api.agentActions.decide, { actionId: id1, decision: "approved" });

  expect(await asOwner.query(api.agentActions.list, {})).toHaveLength(2);
  expect(await asOwner.query(api.agentActions.list, { status: "approved" })).toHaveLength(1);
  expect(await asOwner.query(api.agentActions.list, { status: "proposed" })).toHaveLength(1);
});

test("rejects a non-owner", async () => {
  const t = setupTest();
  const asCustomer = await seedCustomer(t);
  await expect(asCustomer.query(api.agentActions.list, {})).rejects.toThrow();
});
