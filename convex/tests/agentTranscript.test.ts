import { expect, test } from "vitest";
import { api, internal } from "../_generated/api";
import { buildHistory, transcriptFromSteps, TRANSCRIPT_TURNS, type StoredMessage } from "../agent";
import { setupTest, seedOwner, userIdFor } from "../../test/helpers";

// The agent's context. If a tool call does not survive into the next turn, the
// model restarts blind and re-attempts work it already did — or claims work it
// only narrated.

const toolTurn = (name: string): StoredMessage => ({
  role: "assistant",
  content: "Done.",
  modelMessages: [
    { role: "assistant", content: [{ type: "tool-call", toolCallId: "1", toolName: name, input: {} }] },
    { role: "tool", content: [{ type: "tool-result", toolCallId: "1", toolName: name, output: { ok: true } }] },
  ],
});

test("a turn's tool calls and results are replayed into the next turn", () => {
  const history = buildHistory([{ role: "user", content: "write a guide" }, toolTurn("writeBook")]);

  // Not a summary — the actual tool-call and tool-result messages.
  expect(history).toHaveLength(3);
  expect(history[1].role).toBe("assistant");
  expect(JSON.stringify(history)).toContain("writeBook");
  expect(history[2].role).toBe("tool");
});

test("a tool rejection stays visible, so the model can correct instead of repeating it", () => {
  const rejected: StoredMessage = {
    role: "assistant",
    content: "I hit a problem.",
    modelMessages: [
      { role: "assistant", content: [{ type: "tool-call", toolCallId: "1", toolName: "writeBook", input: {} }] },
      {
        role: "tool",
        content: [{ type: "tool-result", toolCallId: "1", toolName: "writeBook", output: { error: 'Unknown category "safety"' } }],
      },
    ],
  };

  expect(JSON.stringify(buildHistory([{ role: "user", content: "go" }, rejected]))).toContain("Unknown category");
});

test("older turns fall back to prose so one draft cannot eat the context window", () => {
  // Two messages per turn, so exceed the cap comfortably.
  const long: StoredMessage[] = [];
  for (let i = 0; i < TRANSCRIPT_TURNS + 3; i++) {
    long.push({ role: "user", content: `ask ${i}` }, toolTurn("getTopSellers"));
  }

  const history = buildHistory(long);
  const replayed = history.filter((m) => m.role === "tool").length;

  expect(replayed).toBeGreaterThan(0);
  expect(replayed).toBeLessThanOrEqual(TRANSCRIPT_TURNS);
  // The oldest turn is summarised, not replayed.
  expect(history[1]).toEqual({ role: "assistant", content: "Done." });
});

test("a turn with no transcript still contributes its prose", () => {
  expect(buildHistory([{ role: "assistant", content: "hello" }])).toEqual([{ role: "assistant", content: "hello" }]);
});

test("the thread persists which tools ran, and hands them back to the model", async () => {
  const t = setupTest();
  const asOwner = await seedOwner(t);
  const ownerId = (await userIdFor(t, "clerk_owner"))!._id;

  const chatId = await asOwner.mutation(api.agentChats.appendTurn, {
    userContent: "write a first aid guide",
    assistantContent: "Review the proposal card below.",
    tools: ["writeBook"],
    modelMessages: toolTurn("writeBook").modelMessages,
  });

  // Visible to the owner in the thread…
  const thread = await asOwner.query(api.agentChats.get, { chatId });
  expect(thread!.messages[1].tools).toEqual(["writeBook"]);

  // …and available to the model on the next turn.
  const forModel = await t.query(internal.agentChats.getForOwner, { ownerId, chatId });
  expect(JSON.stringify(buildHistory(forModel as StoredMessage[]))).toContain("writeBook");
});

test("an unrecorded turn is not reported as having used no tools", async () => {
  // Legacy turns predate tool tracking, and many of them did call tools.
  // Storing nothing must stay distinguishable from storing "ran nothing",
  // otherwise the thread asserts something false about its own history.
  const t = setupTest();
  const asOwner = await seedOwner(t);

  const legacy = await asOwner.mutation(api.agentChats.appendTurn, {
    userContent: "old turn",
    assistantContent: "done",
  });
  const recorded = await asOwner.mutation(api.agentChats.appendTurn, {
    userContent: "new turn",
    assistantContent: "just talking",
    tools: [],
  });

  const legacyThread = await asOwner.query(api.agentChats.get, { chatId: legacy });
  const recordedThread = await asOwner.query(api.agentChats.get, { chatId: recorded });

  expect(legacyThread!.messages[1].tools).toBeUndefined();
  expect(recordedThread!.messages[1].tools).toEqual([]);
});

test("the transcript keeps every step's tool calls, not just the closing prose", () => {
  // result.response.messages carries only the FINAL step, so persisting it kept
  // the answer and dropped the tool calls that produced it.
  const steps = [
    { content: [{ type: "tool-call", toolName: "getTopSellers" }, { type: "tool-result", toolName: "getTopSellers" }] },
    { content: [{ type: "tool-call", toolName: "getRevenue" }, { type: "tool-result", toolName: "getRevenue" }] },
    { content: [{ type: "text", text: "Here's what the stats show" }] },
  ];

  const transcript = transcriptFromSteps(steps);
  const blob = JSON.stringify(transcript);

  expect(blob).toContain("getTopSellers");
  expect(blob).toContain("getRevenue");
  expect(transcript.filter((m) => m.role === "tool")).toHaveLength(2);
  expect(transcript.at(-1)).toMatchObject({ role: "assistant" });
});

test("reasoning parts are not replayed back to the provider", () => {
  const transcript = transcriptFromSteps([
    { content: [{ type: "reasoning", text: "thinking" }, { type: "text", text: "answer" }] },
  ]);
  expect(JSON.stringify(transcript)).not.toContain("thinking");
});

test("tool results are tagged for the provider protocol, not passed through raw", () => {
  // A step's tool-result holds the tool's RAW return; a ToolResultPart requires
  // a tagged ToolResultOutput. Passing steps through unchanged produced
  // "The messages do not match the ModelMessage[] schema" on the NEXT turn, so
  // a chat broke as soon as it had history worth replaying.
  const transcript = transcriptFromSteps([
    {
      content: [
        { type: "tool-call", toolCallId: "c1", toolName: "editBook", input: { title: "X" }, dynamic: false },
        { type: "tool-result", toolCallId: "c1", toolName: "editBook", input: { title: "X" }, output: { data: { ok: true } } },
      ],
    },
  ]);

  const toolMessage = transcript.find((m) => m.role === "tool")!;
  const part = (toolMessage.content as Array<Record<string, unknown>>)[0];
  expect(part.output).toEqual({ type: "json", value: { data: { ok: true } } });
  // Bookkeeping fields the schema rejects must not survive.
  expect(part).not.toHaveProperty("input");
  expect(part).not.toHaveProperty("dynamic");

  const callPart = (transcript[0].content as Array<Record<string, unknown>>)[0];
  expect(Object.keys(callPart).sort()).toEqual(["input", "toolCallId", "toolName", "type"]);
});

test("an already-tagged output is not double-wrapped", () => {
  const transcript = transcriptFromSteps([
    { content: [{ type: "tool-result", toolCallId: "c1", toolName: "t", output: { type: "text", value: "hi" } }] },
  ]);
  const part = (transcript[0].content as Array<Record<string, unknown>>)[0];
  expect(part.output).toEqual({ type: "text", value: "hi" });
});
