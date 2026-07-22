import { expect, test } from "vitest";
import { api } from "../../../_generated/api";
import { setupTest, seedOwner, seedCustomer } from "../../../../test/helpers";

test("returns history newest version first", async () => {
  const t = setupTest();
  const asOwner = await seedOwner(t);

  await asOwner.mutation(api.agentPrompts.create, { content: "v1" });
  await asOwner.mutation(api.agentPrompts.create, { content: "v2" });
  await asOwner.mutation(api.agentPrompts.create, { content: "v3" });

  const rows = await asOwner.query(api.agentPrompts.list, {});
  expect(rows.map((r) => r.version)).toEqual([3, 2, 1]);
});

test("rejects a non-owner", async () => {
  const t = setupTest();
  const asCustomer = await seedCustomer(t);
  await expect(asCustomer.query(api.agentPrompts.list, {})).rejects.toThrow();
});
