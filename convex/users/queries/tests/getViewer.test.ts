import { expect, test } from "vitest";
import { api } from "../../../_generated/api";
import { setupTest } from "../../../../test/helpers";

test("returns null when signed out", async () => {
  const t = setupTest();
  expect(await t.query(api.users.getViewer, {})).toBeNull();
});

test("returns null for a signed-in identity with no synced user row", async () => {
  const t = setupTest();
  const asVisitor = t.withIdentity({ subject: "clerk_unsynced" });
  expect(await asVisitor.query(api.users.getViewer, {})).toBeNull();
});

test("returns the synced user for a signed-in identity", async () => {
  const t = setupTest();
  const asVisitor = t.withIdentity({ subject: "clerk_5" });
  await asVisitor.mutation(api.users.upsertFromClerk, {
    email: "reader@example.com",
    name: "Reader",
  });

  const viewer = await asVisitor.query(api.users.getViewer, {});
  expect(viewer?.email).toBe("reader@example.com");
});
