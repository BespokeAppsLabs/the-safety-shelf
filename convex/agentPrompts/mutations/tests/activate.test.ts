import { expect, test } from "vitest";
import { api } from "../../../_generated/api";
import { setupTest, seedOwner, seedCustomer } from "../../../../test/helpers";

test("owner reactivates a prior version", async () => {
  const t = setupTest();
  const asOwner = await seedOwner(t);

  const firstId = await asOwner.mutation(api.agentPrompts.create, { content: "v1" });
  await asOwner.mutation(api.agentPrompts.create, { content: "v2" });

  await asOwner.mutation(api.agentPrompts.activate, { promptId: firstId });

  const active = await asOwner.query(api.agentPrompts.getActive, {});
  expect(active?._id).toBe(firstId);
  expect(active?.content).toBe("v1");
});

test("rejects an unknown promptId", async () => {
  const t = setupTest();
  const asOwner = await seedOwner(t);
  const id = await asOwner.mutation(api.agentPrompts.create, { content: "v1" });
  await t.run((ctx) => ctx.db.delete(id));

  await expect(asOwner.mutation(api.agentPrompts.activate, { promptId: id })).rejects.toThrow();
});

test("rejects a non-owner", async () => {
  const t = setupTest();
  const asOwner = await seedOwner(t);
  const asCustomer = await seedCustomer(t);
  const id = await asOwner.mutation(api.agentPrompts.create, { content: "v1" });

  await expect(asCustomer.mutation(api.agentPrompts.activate, { promptId: id })).rejects.toThrow();
});
