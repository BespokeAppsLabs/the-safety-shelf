import { expect, test } from "vitest";
import { api } from "../../../_generated/api";
import { setupTest, seedOwner, seedCustomer } from "../../../../test/helpers";

test("owner proposes an agent action", async () => {
  const t = setupTest();
  const asOwner = await seedOwner(t);

  const id = await asOwner.mutation(api.agentActions.propose, {
    tool: "writeBook",
    args: { brief: "Pregnancy safety starter guide" },
  });

  const action = await t.run((ctx) => ctx.db.get(id));
  expect(action?.status).toBe("proposed");
});

test("rejects a non-owner", async () => {
  const t = setupTest();
  const asCustomer = await seedCustomer(t);

  await expect(
    asCustomer.mutation(api.agentActions.propose, { tool: "writeBook", args: {} }),
  ).rejects.toThrow();
});
