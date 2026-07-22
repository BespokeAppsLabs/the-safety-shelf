import { expect, test } from "vitest";
import { api } from "../../../_generated/api";
import { setupTest, seedOwner } from "../../../../test/helpers";

test("soft delete hides the chat from list but keeps the row and messages", async () => {
  const t = setupTest();
  const asOwner = await seedOwner(t);

  const chatId = await asOwner.mutation(api.agentChats.appendTurn, {
    userContent: "hello",
    assistantContent: "hi",
  });

  await asOwner.mutation(api.agentChats.remove, { chatId });

  const list = await asOwner.query(api.agentChats.list, {});
  expect(list).toHaveLength(0);

  const row = await t.run((ctx) => ctx.db.get(chatId));
  expect(row?.deletedAt).toBeTypeOf("number");
  expect(row?.messages).toHaveLength(2); // data is preserved
});

test("rejects deleting another owner's chat", async () => {
  const t = setupTest();
  const asOwnerA = await seedOwner(t, "clerk_owner_a");
  const asOwnerB = await seedOwner(t, "clerk_owner_b");

  const chatId = await asOwnerA.mutation(api.agentChats.appendTurn, {
    userContent: "mine",
    assistantContent: "ok",
  });

  await expect(asOwnerB.mutation(api.agentChats.remove, { chatId })).rejects.toThrow();
});
