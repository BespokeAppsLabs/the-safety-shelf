import { expect, test } from "vitest";
import { api } from "../../../_generated/api";
import { setupTest, seedOwner, seedCustomer, seedLiveBook, userIdFor } from "../../../../test/helpers";

test("returns only the viewer's purchased, non-revoked books", async () => {
  const t = setupTest();
  const asOwner = await seedOwner(t);
  const asCustomer = await seedCustomer(t);
  const userId = (await userIdFor(t, "clerk_customer"))!._id;
  const ownedBookId = await seedLiveBook(t, { slug: "owned-book" });
  const revokedBookId = await seedLiveBook(t, { slug: "revoked-book" });

  await asOwner.mutation(api.entitlements.grant, { userId, bookId: ownedBookId });
  await asOwner.mutation(api.entitlements.grant, { userId, bookId: revokedBookId });
  await asOwner.mutation(api.entitlements.revoke, { userId, bookId: revokedBookId });

  const library = await asCustomer.query(api.entitlements.listForUser, {});
  expect(library.map((b) => b.slug)).toEqual(["owned-book"]);
});

test("returns an empty library for a customer with no purchases", async () => {
  const t = setupTest();
  const asCustomer = await seedCustomer(t);
  expect(await asCustomer.query(api.entitlements.listForUser, {})).toEqual([]);
});
