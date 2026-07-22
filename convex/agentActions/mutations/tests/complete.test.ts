import { expect, test } from "vitest";
import { api } from "../../../_generated/api";
import { setupTest, seedOwner } from "../../../../test/helpers";

test("owner completes an approved action", async () => {
  const t = setupTest();
  const asOwner = await seedOwner(t);
  const actionId = await asOwner.mutation(api.agentActions.propose, { tool: "writeBook", args: {} });
  await asOwner.mutation(api.agentActions.decide, { actionId, decision: "approved" });

  await asOwner.mutation(api.agentActions.complete, { actionId, status: "executed", result: { bookId: "abc" } });

  const action = await t.run((ctx) => ctx.db.get(actionId));
  expect(action?.status).toBe("executed");
});

test("rejects completing an action that was never approved", async () => {
  const t = setupTest();
  const asOwner = await seedOwner(t);
  const actionId = await asOwner.mutation(api.agentActions.propose, { tool: "writeBook", args: {} });

  await expect(
    asOwner.mutation(api.agentActions.complete, { actionId, status: "executed" }),
  ).rejects.toThrow();
});
