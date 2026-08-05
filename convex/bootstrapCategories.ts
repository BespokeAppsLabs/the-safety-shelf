// One-off admin bootstrap for the REAL production taxonomy — not demo content,
// and deliberately not part of convex/seed.ts, which is demo-only and refuses to
// run without ALLOW_DEMO_SEED. This inserts categories and nothing else: no
// books, no blocks. Not part of the public api.*, only callable via
//   npx convex run --prod bootstrapCategories:bootstrapCategories
// Idempotent by slug, so re-running after adding an entry below is safe.
import { internalMutation } from "./_generated/server";

// Descriptions match the house voice from the old demo taxonomy: one short,
// plain-language line, no alarm. The GBV and abuse entries deliberately name
// help-seeking rather than the harm itself — a storefront blurb is the wrong
// place to describe violence, and a reader in that situation needs the exit,
// not the detail.
const CATEGORIES = [
  {
    slug: "pregnancy-care",
    title: "Pregnancy Care",
    icon: "🤰",
    sortOrder: 1,
    description: "Antenatal routines, warning signs, and preparing safely for birth.",
  },
  {
    slug: "newborn-care",
    title: "New Born Care",
    icon: "👶",
    sortOrder: 2,
    description: "Feeding, safe sleep, and settling into the first months at home.",
  },
  {
    slug: "child-safety-at-home",
    title: "Child Safety at Home",
    icon: "🏠",
    sortOrder: 3,
    description: "Everyday hazards, safer spaces, and prevention habits families can keep.",
  },
  {
    slug: "road-safety-for-children",
    title: "Road Safety for Children",
    icon: "🚸",
    sortOrder: 4,
    description: "Car seats, pedestrian awareness, and safer travel routines.",
  },
  {
    slug: "gender-based-violence",
    title: "Gender-based Violence",
    icon: "🛡️",
    sortOrder: 5,
    description: "Recognising the signs, planning for safety, and knowing where to find help.",
  },
  {
    slug: "emotional-and-physical-abuse",
    title: "Emotional & Physical Abuse",
    icon: "🫂",
    sortOrder: 6,
    description: "Understanding harm, supporting someone through it, and routes to support.",
  },
  {
    slug: "pregnancy-and-disability-awareness",
    title: "Pregnancy & Disability Awareness",
    icon: "♿",
    sortOrder: 7,
    description: "Inclusive antenatal care, rights, and support for parents with disabilities.",
  },
  {
    slug: "mine-health-and-safety",
    title: "Mine Health and Safety",
    icon: "⛑️",
    sortOrder: 8,
    description: "Hazard awareness, protective equipment, and emergency response underground.",
  },
];

export const bootstrapCategories = internalMutation({
  args: {},
  handler: async (ctx) => {
    const created: string[] = [];
    const skipped: string[] = [];

    for (const category of CATEGORIES) {
      const existing = await ctx.db
        .query("categories")
        .withIndex("by_slug", (q) => q.eq("slug", category.slug))
        .unique();
      if (existing) {
        skipped.push(category.slug);
        continue;
      }
      await ctx.db.insert("categories", category);
      created.push(category.slug);
    }

    return { created, skipped };
  },
});
