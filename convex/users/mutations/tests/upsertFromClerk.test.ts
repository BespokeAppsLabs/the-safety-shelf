import { expect, test } from "vitest";
import { api } from "../../../_generated/api";
import { setupTest } from "../../../../test/helpers";

test("creates a new user defaulted to customer, keyed on the server-resolved identity", async () => {
  const t = setupTest();
  const asVisitor = t.withIdentity({ subject: "clerk_1" });

  const userId = await asVisitor.mutation(api.users.upsertFromClerk, {
    email: "reader@example.com",
    name: "Reader One",
  });

  const user = await t.run((ctx) => ctx.db.get(userId));
  expect(user?.role).toBe("customer");
  expect(user?.clerkId).toBe("clerk_1");
  expect(user?.email).toBe("reader@example.com");
});

test("is idempotent and patches changed fields on repeat sign-in", async () => {
  const t = setupTest();
  const asVisitor = t.withIdentity({ subject: "clerk_2" });

  const firstId = await asVisitor.mutation(api.users.upsertFromClerk, {
    email: "old@example.com",
    name: "Old Name",
  });
  const secondId = await asVisitor.mutation(api.users.upsertFromClerk, {
    email: "new@example.com",
    name: "New Name",
  });

  expect(secondId).toBe(firstId);
  const user = await t.run((ctx) => ctx.db.get(firstId));
  expect(user?.email).toBe("new@example.com");
  expect(user?.name).toBe("New Name");
});

test("rejects when there is no authenticated identity", async () => {
  const t = setupTest();

  await expect(
    t.mutation(api.users.upsertFromClerk, { email: "reader@example.com", name: "Reader" }),
  ).rejects.toThrow();
});
