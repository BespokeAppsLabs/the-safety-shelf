import { expect, test } from "vitest";
import { api } from "../../../_generated/api";
import { setupTest, seedOwner, seedCustomer } from "../../../../test/helpers";

test("returns null when no prompt has been published", async () => {
  const t = setupTest();
  const asOwner = await seedOwner(t);
  expect(await asOwner.query(api.agentPrompts.getActive, {})).toBeNull();
});

test("returns the active version", async () => {
  const t = setupTest();
  const asOwner = await seedOwner(t);
  await asOwner.mutation(api.agentPrompts.create, { content: "v1" });
  await asOwner.mutation(api.agentPrompts.create, { content: "v2" });

  const active = await asOwner.query(api.agentPrompts.getActive, {});
  expect(active?.content).toBe("v2");
});

test("rejects a non-owner", async () => {
  const t = setupTest();
  const asCustomer = await seedCustomer(t);
  await expect(asCustomer.query(api.agentPrompts.getActive, {})).rejects.toThrow();
});
