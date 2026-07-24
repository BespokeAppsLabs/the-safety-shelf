import { expect, test } from "vitest";
import { formatActionContext, formatSavedDraftContext, pendingApprovalReply, proposalReply, requestedCoverTitle } from "../agent";

test("puts action outcomes into the next-turn context", () => {
  const context = formatActionContext([
    { tool: "writeBook", status: "executed", args: { title: "First Aid" }, result: { bookId: "book_1", slug: "first-aid" }, proposedAt: 1 },
    { tool: "publishBook", status: "rejected", args: { title: "Older Book" }, proposedAt: 2 },
  ]);

  expect(context).toContain("[rejected] publishBook · Older Book");
  expect(context).toContain("[executed] writeBook · First Aid (bookId=book_1, slug=first-aid)");
});

test("never treats chat confirmation as approval of a pending proposal", () => {
  const actions = [{ tool: "generateCoverImage", status: "proposed" as const, args: { title: "Safe Travels" }, proposedAt: 1 }];

  expect(pendingApprovalReply("approved, continue", actions)).toContain("Click the approval button");
  expect(pendingApprovalReply("what needs approval?", actions)).toBeNull();
  expect(pendingApprovalReply("approved", [{ ...actions[0], status: "executed" as const }])).toBeNull();
});

test("uses the card rather than model prose for every proposal", () => {
  expect(proposalReply(["generateCoverImage"], "Would you like me to proceed?", 1)).toBe(
    "Review the proposal card below and use its approval control to continue.",
  );
  expect(proposalReply([], "A normal answer", 0)).toBe("A normal answer");
});

test("recognizes an image request for a book despite title spacing or a typo", () => {
  expect(requestedCoverTitle("Lets genrate an image for NEW BORN HOME READINESS", ["Newborn Home Readiness"])).toBe("Newborn Home Readiness");
  expect(requestedCoverTitle("I can propose generating a cover image for Newborn Home Readiness", ["Newborn Home Readiness"])).toBe("Newborn Home Readiness");
  expect(requestedCoverTitle("What is Newborn Home Readiness about?", ["Newborn Home Readiness"])).toBeNull();
});

test("keeps every saved draft detail available for follow-up work", () => {
  const context = formatSavedDraftContext(
    { _id: "book_1", title: "First Aid", author: "Nomsa", status: "draft", priceCents: 999 },
    [
      { chapter: 1, ord: 0, type: "h", text: "Stay calm" },
      { chapter: 1, ord: 1, type: "p", text: "Call for help." },
    ],
  );

  expect(context).toContain('"title":"First Aid"');
  expect(context).toContain('"text":"Call for help."');
});
