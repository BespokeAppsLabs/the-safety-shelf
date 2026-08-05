import { expect, test } from "vitest";
import { api, internal } from "../../../_generated/api";
import { setupTest, seedOwner, seedTurn } from "../../../../test/helpers";
import { AGENT_RUN_TIMEOUT_MS } from "../../../../lib/agentRun";

test("the session is in History, and marked working, before any reply exists", async () => {
  // The bug this replaces: nothing was written until the agent answered, so
  // leaving the page mid-run destroyed the whole exchange and History showed
  // no trace of a session that was actively running.
  const t = setupTest();
  const asOwner = await seedOwner(t);

  const chatId = await asOwner.mutation(api.agentChats.startTurn, {
    content: "research car seat regulations",
    runId: "run-1",
  });

  const list = await asOwner.query(api.agentChats.list, {});
  expect(list).toMatchObject([{ _id: chatId, busy: true, messageCount: 1 }]);
  expect(list[0].title).toBe("research car seat regulations");

  const thread = await asOwner.query(api.agentChats.get, { chatId });
  expect(thread.messages).toMatchObject([{ role: "user", content: "research car seat regulations" }]);
  expect(thread.runId).toBe("run-1");
});

test("finishing the turn appends the reply and clears the working flag", async () => {
  const t = setupTest();
  const asOwner = await seedOwner(t);

  const chatId = await asOwner.mutation(api.agentChats.startTurn, { content: "hello", runId: "run-1" });
  await t.mutation(internal.agentChats.finishTurn, {
    chatId,
    runId: "run-1",
    content: "hi",
    tools: ["getRevenue"],
  });

  const thread = await asOwner.query(api.agentChats.get, { chatId });
  expect(thread.messages).toMatchObject([
    { role: "user", content: "hello" },
    { role: "assistant", content: "hi", tools: ["getRevenue"] },
  ]);
  expect(thread.runId).toBeUndefined();
  expect((await asOwner.query(api.agentChats.list, {}))[0].busy).toBe(false);
});

test("retrying settlement does not append the assistant turn twice", async () => {
  const t = setupTest();
  const asOwner = await seedOwner(t);

  const chatId = await asOwner.mutation(api.agentChats.startTurn, { content: "hello", runId: "run-1" });
  const reply = { chatId, runId: "run-1", content: "hi", tools: [] };
  await t.mutation(internal.agentChats.finishTurn, reply);
  await t.mutation(internal.agentChats.finishTurn, reply);

  const thread = await asOwner.query(api.agentChats.get, { chatId });
  expect(thread.messages).toHaveLength(2);
});

test("a failed tool is recorded on the turn even though the reply is prose", async () => {
  // The model is told to own its failures and usually does — but it is the
  // thing that failed, so it cannot be the only witness that web research is
  // broken.
  const t = setupTest();
  const asOwner = await seedOwner(t);

  const chatId = await seedTurn(t, asOwner, {
    userContent: "what do current guidelines say?",
    assistantContent: "Here is what I know from memory.",
    tools: [],
    toolErrors: ["researchWeb: Web research is not configured. Set FIRECRAWL_API_KEY in Convex."],
  });

  const thread = await asOwner.query(api.agentChats.get, { chatId });
  expect(thread.messages[1].toolErrors).toEqual([
    "researchWeb: Web research is not configured. Set FIRECRAWL_API_KEY in Convex.",
  ]);
});

test("a stopped turn stays in the thread but leaves the model's history", async () => {
  const t = setupTest();
  const asOwner = await seedOwner(t);
  const ownerId = (await t.run((ctx) => ctx.db.query("users").unique()))!._id;

  const chatId = await asOwner.mutation(api.agentChats.startTurn, { content: "write a book", runId: "run-1" });
  await t.mutation(internal.agentChats.finishTurn, {
    chatId,
    runId: "run-1",
    content: "⏹ Stopped by the user before this response finished.",
    stopped: true,
  });

  // Both halves are visible to the owner…
  const thread = await asOwner.query(api.agentChats.get, { chatId });
  expect(thread.messages).toHaveLength(2);
  expect(thread.runId).toBeUndefined();

  // …and neither reaches the model, so it never resumes the abandoned request.
  const forModel = await t.query(internal.agentChats.getForOwner, { ownerId, chatId });
  expect(forModel).toEqual([]);
});

test("rejects a second active turn in the same chat", async () => {
  const t = setupTest();
  const asOwner = await seedOwner(t);

  const chatId = await asOwner.mutation(api.agentChats.startTurn, { content: "first", runId: "run-1" });
  await expect(
    asOwner.mutation(api.agentChats.startTurn, { chatId, content: "second", runId: "run-2" }),
  ).rejects.toThrow(/already working/);
});

test("an expired run can be replaced without corrupting either turn", async () => {
  const t = setupTest();
  const asOwner = await seedOwner(t);

  const chatId = await asOwner.mutation(api.agentChats.startTurn, { content: "first", runId: "run-1" });
  await t.run((ctx) => ctx.db.patch(chatId, { runStartedAt: Date.now() - AGENT_RUN_TIMEOUT_MS - 1 }));
  await asOwner.mutation(api.agentChats.startTurn, { chatId, content: "second", runId: "run-2" });

  await t.mutation(internal.agentChats.finishTurn, {
    chatId,
    runId: "run-1",
    content: "⏹ Stopped by the user before this response finished.",
    stopped: true,
  });

  const thread = await asOwner.query(api.agentChats.get, { chatId });
  expect(thread.runId).toBe("run-2");
  expect(thread.messages).toMatchObject([
    { role: "user", content: "first", runId: "run-1", stopped: true },
    { role: "assistant", runId: "run-1", stopped: true },
    { role: "user", content: "second", runId: "run-2" },
  ]);
  expect(thread.messages[2].stopped).toBeUndefined();
  expect((await asOwner.query(api.agentChats.list, {}))[0].busy).toBe(true);
});

test("rejects opening a turn in another owner's chat", async () => {
  const t = setupTest();
  const asOwnerA = await seedOwner(t, "clerk_owner_a");
  const asOwnerB = await seedOwner(t, "clerk_owner_b");

  const chatId = await asOwnerA.mutation(api.agentChats.startTurn, { content: "mine", runId: "run-1" });

  await expect(
    asOwnerB.mutation(api.agentChats.startTurn, { chatId, content: "intrusion", runId: "run-2" }),
  ).rejects.toThrow();
});
