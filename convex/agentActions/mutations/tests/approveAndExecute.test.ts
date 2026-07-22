import { expect, test } from "vitest";
import { api } from "../../../_generated/api";
import { setupTest, seedOwner, seedCustomer, seedCategory } from "../../../../test/helpers";
import type { Id } from "../../../_generated/dataModel";

async function seedDraftBook(t: ReturnType<typeof setupTest>, title = "Draft Guide") {
  const categoryId = await seedCategory(t);
  const bookId = await t.run((ctx) =>
    ctx.db.insert("books", {
      slug: "draft-guide",
      title,
      author: "Author",
      priceCents: 999,
      status: "draft" as const,
      categoryId,
      ageGroup: "All ages",
      originalLang: "en",
      blurb: "A draft.",
    }),
  );
  return { categoryId, bookId };
}

test("approving a publishBook proposal flips the book live and marks it executed", async () => {
  const t = setupTest();
  const asOwner = await seedOwner(t);
  const { bookId } = await seedDraftBook(t);

  const actionId = await asOwner.mutation(api.agentActions.propose, {
    tool: "publishBook",
    args: { bookId, title: "Draft Guide" },
    relatedBookId: bookId,
  });
  await asOwner.mutation(api.agentActions.approveAndExecute, { actionId });

  const book = await t.run((ctx) => ctx.db.get(bookId));
  const action = await t.run((ctx) => ctx.db.get(actionId));
  expect(book?.status).toBe("live");
  expect(action?.status).toBe("executed");
});

test("approving a writeBook proposal creates a draft book with its blocks", async () => {
  const t = setupTest();
  const asOwner = await seedOwner(t);
  const categoryId = await seedCategory(t);

  const actionId = await asOwner.mutation(api.agentActions.propose, {
    tool: "writeBook",
    args: {
      title: "Choking First Aid",
      blurb: "What to do in the first 60 seconds.",
      categoryId,
      priceCents: 799,
      chapters: [{ heading: "Stay calm", paragraphs: ["Assess the airway.", "Call for help."] }],
    },
  });
  const result = (await asOwner.mutation(api.agentActions.approveAndExecute, { actionId })) as {
    bookId: Id<"books">;
    slug: string;
  };

  const book = await t.run((ctx) => ctx.db.get(result.bookId));
  const blocks = await t.run((ctx) =>
    ctx.db.query("bookBlocks").withIndex("by_book", (q) => q.eq("bookId", result.bookId)).collect(),
  );
  expect(book?.status).toBe("draft");
  expect(book?.slug).toBe("choking-first-aid");
  expect(blocks.map((b) => b.type)).toEqual(["h", "p", "p"]);
});

test("cannot approve the same proposal twice", async () => {
  const t = setupTest();
  const asOwner = await seedOwner(t);
  const { bookId } = await seedDraftBook(t);

  const actionId = await asOwner.mutation(api.agentActions.propose, {
    tool: "publishBook",
    args: { bookId, title: "Draft Guide" },
  });
  await asOwner.mutation(api.agentActions.approveAndExecute, { actionId });

  await expect(asOwner.mutation(api.agentActions.approveAndExecute, { actionId })).rejects.toThrow();
});

test("a rejected proposal cannot be approved", async () => {
  const t = setupTest();
  const asOwner = await seedOwner(t);
  const { bookId } = await seedDraftBook(t);

  const actionId = await asOwner.mutation(api.agentActions.propose, {
    tool: "publishBook",
    args: { bookId, title: "Draft Guide" },
  });
  await asOwner.mutation(api.agentActions.decide, { actionId, decision: "rejected" });

  await expect(asOwner.mutation(api.agentActions.approveAndExecute, { actionId })).rejects.toThrow();
  const book = await t.run((ctx) => ctx.db.get(bookId));
  expect(book?.status).toBe("draft");
});

test("rejects a non-owner", async () => {
  const t = setupTest();
  const asOwner = await seedOwner(t);
  const asCustomer = await seedCustomer(t);
  const { bookId } = await seedDraftBook(t);

  const actionId = await asOwner.mutation(api.agentActions.propose, {
    tool: "publishBook",
    args: { bookId, title: "Draft Guide" },
  });

  await expect(asCustomer.mutation(api.agentActions.approveAndExecute, { actionId })).rejects.toThrow();
});
