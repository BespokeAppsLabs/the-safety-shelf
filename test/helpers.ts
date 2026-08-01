/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import type { Id } from "../convex/_generated/dataModel";

const modules = import.meta.glob("../convex/**/*.*s");

export function setupTest() {
  return convexTest(schema, modules);
}

type Test = ReturnType<typeof setupTest>;

// Inserts a user row directly, bypassing upsertFromClerk — mirrors production
// reality that the owner role is provisioned manually, never granted by
// self sign-up. Returns the identity-scoped client for that user.
async function seedUser(t: Test, clerkId: string, role: "owner" | "customer") {
  await t.run((ctx) =>
    ctx.db.insert("users", { clerkId, email: `${clerkId}@example.com`, name: clerkId, role }),
  );
  return t.withIdentity({ subject: clerkId });
}

export function seedOwner(t: Test, clerkId = "clerk_owner") {
  return seedUser(t, clerkId, "owner");
}

export function seedCustomer(t: Test, clerkId = "clerk_customer") {
  return seedUser(t, clerkId, "customer");
}

export function seedCategory(t: Test, slug = "first-aid") {
  return t.run((ctx) => ctx.db.insert("categories", { slug, title: slug, sortOrder: 0 }));
}

export async function seedLiveBook(t: Test, overrides: Partial<{ slug: string; priceCents: number }> = {}) {
  const categoryId = await seedCategory(t);
  // A live, priced book implies a store that knows what it prices in — the app
  // refuses to render or sell without a base currency, so a fixture without
  // one is not a state production can reach. Tests that want the unset case
  // clear the row explicitly.
  const settings = await t.run((ctx) => ctx.db.query("storeSettings").first());
  if (!settings) await seedStoreSettings(t);
  return t.run((ctx) =>
    ctx.db.insert("books", {
      slug: overrides.slug ?? "first-aid-quick-guide",
      title: "First Aid Quick Guide",
      author: "Nomsa Pillay",
      priceCents: overrides.priceCents ?? 999,
      status: "live",
      categoryId,
      ageGroup: "All ages",
      originalLang: "en",
      blurb: "A fast-reference primer.",
    }),
  );
}

export function seedStoreSettings(t: Test, baseCurrency = "ZAR") {
  return t.run((ctx) => ctx.db.insert("storeSettings", { baseCurrency }));
}

/**
 * A completed sale, written directly. Tests used to call entitlements
 * .demoPurchase for this; that mutation is gone now that checkout goes through
 * Paystack, and driving a real gateway round-trip just to arrange a fixture
 * would test the network rather than the query under test.
 */
export async function seedPurchase(
  t: Test,
  { userId, bookId, priceCents, status = "paid" as const }: {
    userId: Id<"users">;
    bookId: Id<"books">;
    priceCents: number;
    status?: "pending" | "paid" | "refunded";
  },
) {
  return t.run(async (ctx) => {
    const orderId = await ctx.db.insert("orders", {
      userId,
      reference: `test:${bookId}:${Date.now()}:${Math.random()}`,
      totalCents: priceCents,
      currency: "ZAR",
      status,
    });
    await ctx.db.insert("orderItems", { orderId, bookId, priceCents });
    if (status === "paid") {
      await ctx.db.insert("entitlements", { userId, bookId, orderId, grantedAt: Date.now() });
    }
    return orderId;
  });
}

// Looks up the users._id for a clerkId seeded via seedOwner/seedCustomer —
// grant/revoke take a userId, not a clerkId.
export function userIdFor(t: Test, clerkId: string) {
  return t.run((ctx) =>
    ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId))
      .unique(),
  );
}
