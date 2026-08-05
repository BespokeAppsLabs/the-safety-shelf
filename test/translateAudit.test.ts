import { afterEach, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import { encryptSecret } from "../convex/lib/secrets";
import { OPENROUTER_TRANSLATION_MODEL } from "../convex/aiCredentials/providers";
import { setupTest, seedOwner, seedLiveBook, seedTurn, userIdFor } from "./helpers";

afterEach(() => vi.unstubAllGlobals());

// One structured response satisfying both schemas — zod strips the keys each
// call does not ask for, so meta and chapter can share a mock.
function completion(servedModel: string) {
  return new Response(JSON.stringify({
    id: "1",
    object: "chat.completion",
    created: 1,
    model: servedModel,
    choices: [{
      index: 0,
      message: { role: "assistant", content: JSON.stringify({ title: "T", blurb: "B", heading: "H", paragraphs: ["P"] }) },
      finish_reason: "stop",
    }],
    usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 },
  }), { status: 200, headers: { "content-type": "application/json" } });
}

async function seedTranslatableBook(t: ReturnType<typeof setupTest>, asOwner: Awaited<ReturnType<typeof seedOwner>>) {
  const ownerId = (await userIdFor(t, "clerk_owner"))!._id;
  process.env.AI_CREDENTIALS_ENCRYPTION_KEY = "test-key";
  await t.run((ctx) =>
    ctx.db.insert("aiCredentials", {
      ownerId,
      provider: "openrouter" as const,
      kind: "apiKey" as const,
      encryptedKey: encryptSecret("sk-or-test"),
      isActive: true,
    }),
  );
  const bookId = await seedLiveBook(t);
  await asOwner.mutation(api.bookBlocks.setBlocks, {
    bookId,
    blocks: [
      { chapter: 1, ord: 0, type: "h" as const, text: "Chapter one" },
      { chapter: 1, ord: 1, type: "p" as const, text: "One paragraph." },
    ],
  });
  return bookId;
}

test("records the model the provider actually served, not the one requested", async () => {
  // OpenRouter may serve a fallback rather than the requested model. An audit
  // row that echoes the constant we asked for would hide that substitution and
  // make the behaviour and bill impossible to explain.
  const t = setupTest();
  const asOwner = await seedOwner(t);
  const bookId = await seedTranslatableBook(t, asOwner);

  vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(completion("someone/else-entirely"))));
  // Run it the way the SCHEDULER does — `t`, not `asOwner`, so there is no
  // Clerk identity. An approved translation is dispatched with nothing but an
  // ownerId, and every read and write it performs has to survive that. It did
  // not: the run reached for viewer-scoped queries and died on "Not
  // authenticated" 20ms in, before any provider call, leaving the proposal
  // stuck at "approved" forever. Calling this with an identity hides the fault.
  const ownerId = (await userIdFor(t, "clerk_owner"))!._id;
  const actionId = await asOwner.mutation(api.agentActions.propose, {
    tool: "translateBook",
    args: { bookId, lang: "af" },
    relatedBookId: bookId,
  });
  const chatId = await seedTurn(t, asOwner, {
    userContent: "Translate the book",
    assistantContent: "Approve this translation.",
    cards: [{ component: "ProposalCard", props: { actionId } }],
  });
  await t.run((ctx) => ctx.db.patch(actionId, { status: "approved", decidedAt: Date.now() }));
  const runId = actionId as string;
  await t.mutation(internal.translateData.reserveRun, { ownerId, bookId, lang: "af", runId });
  await t.action(internal.translate.runForOwner, { ownerId, bookId, lang: "af", runId, actionId });

  const logs = await t.run((ctx) => ctx.db.query("agentLogs").collect());
  expect(logs).toHaveLength(1); // one row per translation, not per provider call
  expect(logs[0]).toMatchObject({
    role: "translator",
    model: "someone/else-entirely",
    subject: "First Aid Quick Guide → af",
    status: "ok",
  });
  expect(logs[0].model).not.toBe(OPENROUTER_TRANSLATION_MODEL);
  // Usage is summed across the metadata call and every chapter call.
  expect(logs[0].inputTokens).toBe(20);
  expect(logs[0].outputTokens).toBe(8);
  expect((await asOwner.query(api.agentActions.get, { actionId }))!.status).toBe("executed");
  expect((await t.run((ctx) => ctx.db.get(bookId)))?.translationRun).toBeUndefined();
  const thread = await asOwner.query(api.agentChats.get, { chatId });
  expect(thread.messages.at(-1)?.cards?.[0].component).toBe("TranslationReviewCard");
});

test("records a failed translation with the provider's own wording", async () => {
  const t = setupTest();
  const asOwner = await seedOwner(t);
  const bookId = await seedTranslatableBook(t, asOwner);

  // 400, not 5xx: the AI SDK retries server errors with backoff, and this test
  // is about what gets recorded, not about retry behaviour. A non-JSON body is
  // the real shape of an OpenRouter throttle or routing failure — the one that
  // surfaced as "Invalid JSON response" with no trail of what had happened.
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
    new Response("upstream exploded", { status: 400, headers: { "content-type": "text/plain" } }),
  ));
  await expect(asOwner.action(api.translate.translate, { bookId, lang: "af" })).rejects.toThrow();

  const logs = await t.run((ctx) => ctx.db.query("agentLogs").collect());
  expect(logs).toHaveLength(1);
  expect(logs[0]).toMatchObject({ role: "translator", status: "error", subject: "First Aid Quick Guide → af" });
  // The owner-facing message is deliberately softened; the trail keeps the
  // truth — including the status and body, since an APICallError raised from a
  // non-JSON body carries an empty `message` and would otherwise record a
  // failure with no reason attached.
  expect(logs[0].errorMessage).toContain("HTTP 400");
  expect(logs[0].errorMessage).toContain("upstream exploded");
});

test("does not report success when the translation was never stored", async () => {
  const t = setupTest();
  const asOwner = await seedOwner(t);
  const bookId = await seedTranslatableBook(t, asOwner);

  // Paragraph count mismatch: the model returned usable JSON, so the provider
  // calls succeeded, but the run produced nothing the owner can use.
  vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({
    id: "1", object: "chat.completion", created: 1, model: "m",
    choices: [{ index: 0, message: { role: "assistant", content: JSON.stringify({ title: "T", blurb: "B", heading: "H", paragraphs: ["a", "b", "c"] }) }, finish_reason: "stop" }],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  }), { status: 200, headers: { "content-type": "application/json" } }))));

  await expect(asOwner.action(api.translate.translate, { bookId, lang: "af" })).rejects.toThrow();

  const logs = await t.run((ctx) => ctx.db.query("agentLogs").collect());
  expect(logs[0].status).toBe("error");
  expect(await t.run((ctx) => ctx.db.query("bookVariants").collect())).toHaveLength(0);
});
