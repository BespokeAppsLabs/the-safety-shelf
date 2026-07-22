import { expect, test } from "vitest";
import { api, internal } from "../../../_generated/api";
import { setupTest, seedOwner, seedCustomer, userIdFor } from "../../../../test/helpers";

test("cancel before begin pre-records the stop; begin then reports cancelled", async () => {
  const t = setupTest();
  const asOwner = await seedOwner(t);
  const owner = await userIdFor(t, "clerk_owner");

  // Stop races ahead of the action starting.
  await asOwner.mutation(api.agentRuns.cancel, { runId: "run-1" });
  const started = await t.mutation(internal.agentRuns.begin, { runId: "run-1", ownerId: owner!._id });

  expect(started.cancelled).toBe(true);
});

test("cancel after begin flips the polled status", async () => {
  const t = setupTest();
  const asOwner = await seedOwner(t);
  const owner = await userIdFor(t, "clerk_owner");

  const started = await t.mutation(internal.agentRuns.begin, { runId: "run-2", ownerId: owner!._id });
  expect(started.cancelled).toBe(false);

  let polled = await t.query(internal.agentRuns.status, { runId: "run-2" });
  expect(polled.cancelled).toBe(false);

  await asOwner.mutation(api.agentRuns.cancel, { runId: "run-2" });
  polled = await t.query(internal.agentRuns.status, { runId: "run-2" });
  expect(polled.cancelled).toBe(true);
});

test("finish removes the run row", async () => {
  const t = setupTest();
  const asOwner = await seedOwner(t);
  const owner = await userIdFor(t, "clerk_owner");

  await t.mutation(internal.agentRuns.begin, { runId: "run-3", ownerId: owner!._id });
  await t.mutation(internal.agentRuns.finish, { runId: "run-3" });

  const rows = await t.run((ctx) =>
    ctx.db.query("agentRuns").withIndex("by_runId", (q) => q.eq("runId", "run-3")).collect(),
  );
  expect(rows).toHaveLength(0);
});

test("rejects a non-owner cancelling", async () => {
  const t = setupTest();
  await seedOwner(t);
  const asCustomer = await seedCustomer(t);

  await expect(asCustomer.mutation(api.agentRuns.cancel, { runId: "run-4" })).rejects.toThrow();
});
