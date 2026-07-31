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

test("refuses to approve a writeBook whose title already exists", async () => {
  const t = setupTest();
  const asOwner = await seedOwner(t);
  const { categoryId } = await seedDraftBook(t, "Pregnancy Safety Basics");

  const actionId = await asOwner.mutation(api.agentActions.propose, {
    tool: "writeBook",
    args: {
      title: "Pregnancy Safety Basics",
      blurb: "A second copy.",
      categoryId,
      priceCents: 999,
      chapters: [{ heading: "Ch", paragraphs: ["Text."] }],
    },
  });

  await expect(asOwner.mutation(api.agentActions.approveAndExecute, { actionId })).rejects.toThrow(/already exists/);
  const books = await t.run((ctx) => ctx.db.query("books").collect());
  expect(books).toHaveLength(1);
});

test("approving an editBook replaces content on the same book", async () => {
  const t = setupTest();
  const asOwner = await seedOwner(t);
  const { bookId } = await seedDraftBook(t);
  await t.run(async (ctx) => {
    await ctx.db.insert("bookBlocks", { bookId, chapter: 1, ord: 0, type: "h", text: "Old" });
    await ctx.db.insert("bookBlocks", { bookId, chapter: 1, ord: 1, type: "p", text: "Old text." });
  });

  const actionId = await asOwner.mutation(api.agentActions.propose, {
    tool: "editBook",
    args: {
      bookId,
      title: "Draft Guide",
      priceCents: 1299,
      chapters: [
        { heading: "Old", paragraphs: ["Old text."] },
        { heading: "New chapter", paragraphs: ["Added text."] },
      ],
    },
    relatedBookId: bookId,
  });
  await asOwner.mutation(api.agentActions.approveAndExecute, { actionId });

  const books = await t.run((ctx) => ctx.db.query("books").collect());
  const blocks = await t.run((ctx) =>
    ctx.db.query("bookBlocks").withIndex("by_book", (q) => q.eq("bookId", bookId)).collect(),
  );
  // The whole point: one book, edited — not a second one.
  expect(books).toHaveLength(1);
  expect(books[0].priceCents).toBe(1299);
  expect(books[0].slug).toBe("draft-guide");
  expect(blocks.map((b) => b.text)).toEqual(["Old", "Old text.", "New chapter", "Added text."]);
});

test("an editBook rename cannot collide with another book's title", async () => {
  const t = setupTest();
  const asOwner = await seedOwner(t);
  const { bookId, categoryId } = await seedDraftBook(t, "Draft Guide");
  await t.run((ctx) =>
    ctx.db.insert("books", {
      slug: "first-aid-quick-guide",
      title: "First Aid Quick Guide",
      author: "Author",
      priceCents: 999,
      status: "live" as const,
      categoryId,
      ageGroup: "All ages",
      originalLang: "en",
      blurb: "Taken.",
    }),
  );

  const actionId = await asOwner.mutation(api.agentActions.propose, {
    tool: "editBook",
    args: { bookId, title: "Draft Guide", newTitle: "First Aid Quick Guide" },
    relatedBookId: bookId,
  });

  await expect(asOwner.mutation(api.agentActions.approveAndExecute, { actionId })).rejects.toThrow(/already exists/);
});

test("an editBook can rename a book to its own title unchanged", async () => {
  const t = setupTest();
  const asOwner = await seedOwner(t);
  const { bookId } = await seedDraftBook(t, "Draft Guide");

  const actionId = await asOwner.mutation(api.agentActions.propose, {
    tool: "editBook",
    args: { bookId, title: "Draft Guide", newTitle: "Draft Guide", blurb: "Reworded." },
    relatedBookId: bookId,
  });
  await asOwner.mutation(api.agentActions.approveAndExecute, { actionId });

  const book = await t.run((ctx) => ctx.db.get(bookId));
  expect(book?.blurb).toBe("Reworded.");
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
