import { expect, test } from "vitest";
import { api } from "../../../_generated/api";
import { setupTest, seedOwner } from "../../../../test/helpers";

test("adds one visible failure update to the proposal chat", async () => {
  const t = setupTest();
  const asOwner = await seedOwner(t);
  const actionId = await asOwner.mutation(api.agentActions.propose, { tool: "generateCoverImage", args: { title: "First Aid" } });
  const chatId = await asOwner.mutation(api.agentChats.appendTurn, {
    userContent: "Generate a cover",
    assistantContent: "I prepared the request.",
    cards: [{ component: "ImageGenerationProposalCard", props: { actionId } }],
  });

  await asOwner.mutation(api.agentChats.appendActionUpdate, { actionId, content: "I couldn’t generate the cover: provider failed." });
  await asOwner.mutation(api.agentChats.appendActionUpdate, { actionId, content: "duplicate" });

  const chat = await asOwner.query(api.agentChats.get, { chatId });
  expect(chat.messages.filter((message) => message.actionId === actionId).map((message) => message.content))
    .toEqual(["I couldn’t generate the cover: provider failed."]);
});
