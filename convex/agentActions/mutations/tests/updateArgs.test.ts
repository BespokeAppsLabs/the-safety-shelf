import { expect, test } from "vitest";
import { api } from "../../../_generated/api";
import { setupTest, seedOwner, seedCustomer, seedCategory } from "../../../../test/helpers";
import type { Id } from "../../../_generated/dataModel";

async function proposeDraft(t: ReturnType<typeof setupTest>, asOwner: Awaited<ReturnType<typeof seedOwner>>) {
  const categoryId = await seedCategory(t);
  const actionId = await asOwner.mutation(api.agentActions.propose, {
    tool: "writeBook",
    args: {
      title: "Choking First Aid",
      author: "Agent",
      blurb: "The first 60 seconds.",
      categoryId,
      ageGroup: "All ages",
      priceCents: 799,
      chapters: [{ heading: "Stay calm", paragraphs: ["Assess the airway."] }],
    },
  });
  return { categoryId, actionId };
}

const EDIT = {
  title: "Choking First Aid, Revised",
  blurb: "Edited blurb.",
  priceCents: 899,
  chapters: [{ heading: "Stay very calm", paragraphs: ["Assess the airway.", "Call for help."] }],
};

test("editing a proposal keeps the fields the dialog does not show", async () => {
  const t = setupTest();
  const asOwner = await seedOwner(t);
  const { categoryId, actionId } = await proposeDraft(t, asOwner);

  await asOwner.mutation(api.agentActions.updateArgs, { actionId, ...EDIT });

  const action = await t.run((ctx) => ctx.db.get(actionId));
  expect(action?.args).toMatchObject({ ...EDIT, author: "Agent", ageGroup: "All ages", categoryId });
  expect(action?.status).toBe("proposed");
});

test("approving after an edit writes the edited content", async () => {
  const t = setupTest();
  const asOwner = await seedOwner(t);
  const { actionId } = await proposeDraft(t, asOwner);

  await asOwner.mutation(api.agentActions.updateArgs, { actionId, ...EDIT });
  const result = (await asOwner.mutation(api.agentActions.approveAndExecute, { actionId })) as {
    bookId: Id<"books">;
  };

  const book = await t.run((ctx) => ctx.db.get(result.bookId));
  const blocks = await t.run((ctx) =>
    ctx.db.query("bookBlocks").withIndex("by_book", (q) => q.eq("bookId", result.bookId)).collect(),
  );
  expect(book?.title).toBe(EDIT.title);
  expect(book?.priceCents).toBe(899);
  expect(blocks.map((b) => b.text)).toEqual(["Stay very calm", "Assess the airway.", "Call for help."]);
});

test("rejects an empty title or a non-positive price", async () => {
  const t = setupTest();
  const asOwner = await seedOwner(t);
  const { actionId } = await proposeDraft(t, asOwner);

  await expect(asOwner.mutation(api.agentActions.updateArgs, { actionId, ...EDIT, title: "  " })).rejects.toThrow();
  await expect(asOwner.mutation(api.agentActions.updateArgs, { actionId, ...EDIT, priceCents: 0 })).rejects.toThrow();
});

test("rejects an already-decided proposal", async () => {
  const t = setupTest();
  const asOwner = await seedOwner(t);
  const { actionId } = await proposeDraft(t, asOwner);
  await asOwner.mutation(api.agentActions.decide, { actionId, decision: "rejected" });

  await expect(asOwner.mutation(api.agentActions.updateArgs, { actionId, ...EDIT })).rejects.toThrow();
});

test("rejects a tool other than writeBook", async () => {
  const t = setupTest();
  const asOwner = await seedOwner(t);
  const categoryId = await seedCategory(t);
  const bookId = await t.run((ctx) =>
    ctx.db.insert("books", {
      slug: "draft-guide",
      title: "Draft Guide",
      author: "Author",
      priceCents: 999,
      status: "draft" as const,
      categoryId,
      ageGroup: "All ages",
      originalLang: "en",
      blurb: "A draft.",
    }),
  );
  const actionId = await asOwner.mutation(api.agentActions.propose, {
    tool: "publishBook",
    args: { bookId, title: "Draft Guide" },
  });

  await expect(asOwner.mutation(api.agentActions.updateArgs, { actionId, ...EDIT })).rejects.toThrow();
});

test("rejects a non-owner", async () => {
  const t = setupTest();
  const asOwner = await seedOwner(t);
  const asCustomer = await seedCustomer(t);
  const { actionId } = await proposeDraft(t, asOwner);

  await expect(asCustomer.mutation(api.agentActions.updateArgs, { actionId, ...EDIT })).rejects.toThrow();
});
