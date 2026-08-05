import { expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import { setupTest, seedLiveBook, seedOwner, userIdFor } from "./helpers";

test("a missing key settles the durable turn and records explicit non-use", async () => {
  const t = setupTest();
  const asOwner = await seedOwner(t);
  const chatId = await asOwner.mutation(api.agentChats.startTurn, { content: "hello", runId: "run-1" });

  await asOwner.action(api.agent.sendMessage, { message: "hello", chatId, runId: "run-1" });

  const thread = await asOwner.query(api.agentChats.get, { chatId });
  expect(thread.runId).toBeUndefined();
  expect(thread.messages).toMatchObject([
    { role: "user", content: "hello" },
    { role: "assistant", tools: [], content: expect.stringContaining("No OpenRouter key") },
  ]);
});

test("the deterministic cover proposal preserves its tool trace", async () => {
  const t = setupTest();
  const asOwner = await seedOwner(t);
  await seedLiveBook(t);
  const ownerId = (await userIdFor(t, "clerk_owner"))!._id;
  await t.run((ctx) => ctx.db.insert("aiCredentials", {
    ownerId,
    provider: "openrouter",
    kind: "apiKey",
    encryptedKey: "unused-on-deterministic-route",
    isActive: true,
  }));
  const message = "Create a cover image for First Aid Quick Guide";
  const chatId = await asOwner.mutation(api.agentChats.startTurn, { content: message, runId: "run-2" });

  await asOwner.action(api.agent.sendMessage, { message, chatId, runId: "run-2" });

  const thread = await asOwner.query(api.agentChats.get, { chatId });
  expect(thread.messages[1]).toMatchObject({
    role: "assistant",
    tools: ["generateCoverImage"],
    cards: [{ component: "ImageGenerationProposalCard" }],
  });
});
