import { expect, test } from "vitest";
import { api, internal } from "../../../_generated/api";
import { setupTest, seedOwner, seedLiveBook, seedTurn } from "../../../../test/helpers";

// The proposal, and the chat turn holding its card, as the tool would leave them.
async function proposeTranslation(
  t: ReturnType<typeof setupTest>,
  asOwner: Awaited<ReturnType<typeof seedOwner>>,
  existingBookId?: Awaited<ReturnType<typeof seedLiveBook>>,
) {
  const bookId = existingBookId ?? await seedLiveBook(t);
  const actionId = await asOwner.mutation(api.agentActions.propose, {
    tool: "translateBook",
    args: { bookId, lang: "af", title: "First Aid Quick Guide", language: "Afrikaans" },
    relatedBookId: bookId,
  });
  const chatId = await seedTurn(t, asOwner, {
    userContent: "translate the first aid guide into afrikaans",
    assistantContent: "Approve the translation below.",
    cards: [{ component: "ProposalCard", props: { actionId } }],
  });
  return { bookId, actionId, chatId };
}

test("approving a translation dispatches it and does NOT claim it is done", async () => {
  // [executed] is the agent's proof that a write happened — the system prompt
  // says so. Translation runs for minutes after the click, so marking it
  // executed on approval would let the agent announce a translation before a
  // single word had been written.
  const t = setupTest();
  const asOwner = await seedOwner(t);
  const { actionId } = await proposeTranslation(t, asOwner);

  const result = await asOwner.mutation(api.agentActions.approveAndExecute, { actionId });
  expect(result).toMatchObject({ started: true, lang: "af" });

  const action = await asOwner.query(api.agentActions.get, { actionId });
  expect(action!.status).toBe("approved");
  expect(action!.decidedAt).toBeTypeOf("number");
});

test("a book cannot start a second translation while the first is active", async () => {
  const t = setupTest();
  const asOwner = await seedOwner(t);
  const first = await proposeTranslation(t, asOwner);
  const second = await proposeTranslation(t, asOwner, first.bookId);

  await asOwner.mutation(api.agentActions.approveAndExecute, { actionId: first.actionId });
  await expect(
    asOwner.mutation(api.agentActions.approveAndExecute, { actionId: second.actionId }),
  ).rejects.toThrow(/already running/);

  const book = await t.run((ctx) => ctx.db.get(first.bookId));
  expect(book?.translationRun).toMatchObject({ runId: first.actionId, lang: "af" });
  expect((await asOwner.query(api.agentActions.get, { actionId: second.actionId }))!.status).toBe("proposed");
});

test("a second completion cannot stack a duplicate notice", async () => {
  const t = setupTest();
  const asOwner = await seedOwner(t);
  const { bookId, actionId, chatId } = await proposeTranslation(t, asOwner);
  const ownerId = (await t.run((ctx) => ctx.db.query("users").unique()))!._id;
  await t.run((ctx) => ctx.db.patch(actionId, { status: "approved", decidedAt: Date.now() }));

  const update = { ownerId, actionId, content: "ready", cards: [{ component: "TranslationReviewCard", props: { actionId, bookId } }] };
  expect(await t.mutation(internal.agentChats.appendActionUpdateForOwner, update)).toBe(true);
  expect(await t.mutation(internal.agentChats.appendActionUpdateForOwner, update)).toBe(false);

  const thread = await asOwner.query(api.agentChats.get, { chatId });
  expect(thread.messages.filter((message) => message.actionId === actionId)).toHaveLength(1);
});

test("a run rejected before it starts still resolves the proposal", async () => {
  // The dead end this closes: the pre-flight guards (no provider key, book
  // gone, an unsaved draft in the way) used to throw straight out of the
  // scheduled run. Nothing then resolved the row, so it sat at "approved" and
  // the chat said "Translating…" forever. Here the run rejects for want of a
  // provider key — the approval must still come to rest, and say why.
  const t = setupTest();
  const asOwner = await seedOwner(t);
  const { bookId, actionId, chatId } = await proposeTranslation(t, asOwner);
  const ownerId = (await t.run((ctx) => ctx.db.query("users").unique()))!._id;
  const runId = actionId as string;

  await t.run((ctx) => ctx.db.patch(actionId, { status: "approved", decidedAt: Date.now() }));
  await t.mutation(internal.translateData.reserveRun, { ownerId, bookId, lang: "af", runId });
  // Invoked directly rather than through the scheduler: convex-test does not
  // dispatch scheduled Node actions, so going via approveAndExecute would
  // assert the harness rather than this code.
  await expect(
    t.action(internal.translate.runForOwner, { ownerId, bookId, lang: "af", runId, actionId }),
  ).rejects.toThrow();

  const action = await asOwner.query(api.agentActions.get, { actionId });
  expect(action!.status).toBe("failed");
  expect((action!.result as { error?: string }).error).toMatch(/OpenRouter key/);

  const thread = await asOwner.query(api.agentChats.get, { chatId });
  expect(thread.messages[thread.messages.length - 1].content).toMatch(/translation failed/i);
  expect((await t.run((ctx) => ctx.db.get(bookId)))?.translationRun).toBeUndefined();
});

test("the expiry backstop fails an approval whose Node action never settles", async () => {
  const t = setupTest();
  const asOwner = await seedOwner(t);
  const { bookId, actionId } = await proposeTranslation(t, asOwner);
  await asOwner.mutation(api.agentActions.approveAndExecute, { actionId });
  await t.run((ctx) => ctx.db.patch(bookId, {
    translationRun: { runId: actionId as string, lang: "af", startedAt: 0 },
  }));

  expect(await t.mutation(internal.translateData.expireRun, { bookId, runId: actionId as string, actionId })).toBe(true);
  expect((await asOwner.query(api.agentActions.get, { actionId }))!.status).toBe("failed");
  expect((await t.run((ctx) => ctx.db.get(bookId)))?.translationRun).toBeUndefined();
});

test("the expiry backstop fails the old approval without clearing a newer lease", async () => {
  const t = setupTest();
  const asOwner = await seedOwner(t);
  const { bookId, actionId } = await proposeTranslation(t, asOwner);
  await t.run(async (ctx) => {
    await Promise.all([
      ctx.db.patch(actionId, { status: "approved", decidedAt: Date.now() }),
      ctx.db.patch(bookId, { translationRun: { runId: "new-run", lang: "zu", startedAt: Date.now() } }),
    ]);
  });

  expect(await t.mutation(internal.translateData.expireRun, { bookId, runId: actionId as string, actionId })).toBe(true);
  expect((await asOwner.query(api.agentActions.get, { actionId }))!.status).toBe("failed");
  expect((await t.run((ctx) => ctx.db.get(bookId)))?.translationRun).toMatchObject({ runId: "new-run", lang: "zu" });
});

test("failure settlement cannot flip a completed proposal", async () => {
  const t = setupTest();
  const asOwner = await seedOwner(t);
  const { bookId, actionId } = await proposeTranslation(t, asOwner);
  const ownerId = (await t.run((ctx) => ctx.db.query("users").unique()))!._id;
  await t.run((ctx) => ctx.db.patch(actionId, { status: "executed", decidedAt: Date.now() }));

  await t.mutation(internal.translateData.failRun, {
    ownerId,
    bookId,
    runId: actionId as string,
    actionId,
    reason: "late failure",
  });

  expect((await asOwner.query(api.agentActions.get, { actionId }))!.status).toBe("executed");
});
