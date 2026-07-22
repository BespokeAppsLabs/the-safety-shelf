import { expect, test } from "vitest";
import { api } from "../../../_generated/api";
import { setupTest, seedOwner } from "../../../../test/helpers";

test("first turn opens a new session titled from the user message", async () => {
  const t = setupTest();
  const asOwner = await seedOwner(t);

  const chatId = await asOwner.mutation(api.agentChats.appendTurn, {
    userContent: "How are sales doing?",
    assistantContent: "Here's a summary.",
    cards: [{ component: "RevenueStatsCard", props: { totalUnits: 3, totalRevenueCents: 900 } }],
  });

  const chat = await asOwner.query(api.agentChats.get, { chatId });
  expect(chat.title).toBe("How are sales doing?");
  expect(chat.messages).toHaveLength(2);
  expect(chat.messages[1].cards?.[0].component).toBe("RevenueStatsCard");
});

test("appending with a chatId extends the same session", async () => {
  const t = setupTest();
  const asOwner = await seedOwner(t);

  const chatId = await asOwner.mutation(api.agentChats.appendTurn, {
    userContent: "first",
    assistantContent: "reply one",
  });
  await asOwner.mutation(api.agentChats.appendTurn, {
    chatId,
    userContent: "second",
    assistantContent: "reply two",
  });

  const chat = await asOwner.query(api.agentChats.get, { chatId });
  expect(chat.messages.map((m) => m.content)).toEqual(["first", "reply one", "second", "reply two"]);
});

test("a stopped turn is committed like any other (so the agent sees it next turn)", async () => {
  const t = setupTest();
  const asOwner = await seedOwner(t);

  const chatId = await asOwner.mutation(api.agentChats.appendTurn, {
    userContent: "write me a book",
    assistantContent: "⏹ Stopped by the user before this response finished.",
  });

  const chat = await asOwner.query(api.agentChats.get, { chatId });
  expect(chat.messages[1].content).toMatch(/Stopped by the user/);
});

test("rejects appending to another owner's chat", async () => {
  const t = setupTest();
  const asOwnerA = await seedOwner(t, "clerk_owner_a");
  const asOwnerB = await seedOwner(t, "clerk_owner_b");

  const chatId = await asOwnerA.mutation(api.agentChats.appendTurn, {
    userContent: "mine",
    assistantContent: "ok",
  });

  await expect(
    asOwnerB.mutation(api.agentChats.appendTurn, { chatId, userContent: "intrusion", assistantContent: "no" }),
  ).rejects.toThrow();
});
