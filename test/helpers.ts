/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import schema from "../convex/schema";

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
