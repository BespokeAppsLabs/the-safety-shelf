// One-shot demo data, ported from the old lib/catalog.ts / lib/landing.ts
// local arrays. Run once with: npx convex run seed:seed
import { ConvexError, v } from "convex/values";
import { internalMutation } from "./_generated/server";

type SeedBlock = { chapter: number; ord: number; type: "h" | "p"; text: string };

const CATEGORIES = [
  { slug: "pregnancy-safety", title: "Pregnancy Safety", icon: "🤰", sortOrder: 1, description: "Home routines, warning signs, and preparation checklists." },
  { slug: "child-safety", title: "Child Safety", icon: "🧸", sortOrder: 2, description: "Sleep spaces, toddler hazards, and family prevention habits." },
  { slug: "first-aid", title: "First Aid", icon: "⛑️", sortOrder: 3, description: "Fast-reference responses for the moments that count." },
  { slug: "emergency-preparedness", title: "Emergency Preparedness", icon: "🏠", sortOrder: 4, description: "Fire, outages, storms, and sudden-evacuation response plans." },
  { slug: "food-hygiene", title: "Food & Hygiene", icon: "🧼", sortOrder: 5, description: "Kitchen, storage, and daily hygiene habits that are simple to repeat." },
  { slug: "workplace-safety", title: "Workplace Safety", icon: "🦺", sortOrder: 6, description: "Hazard awareness, response plans, and reporting habits for small teams." },
];

const BOOKS: Array<{
  slug: string; title: string; author: string; priceCents: number; categorySlug: string;
  ageGroup: string; blurb: string; gradientFrom: string; gradientTo: string; blocks: SeedBlock[];
}> = [
  {
    slug: "pregnancy-safety-basics", title: "Pregnancy Safety Basics", author: "Dr. Lindi Mokoena",
    priceCents: 1499, categorySlug: "pregnancy-safety", ageGroup: "Parents",
    blurb: "A plain-language guide to safe routines, warning signs, and home adjustments during pregnancy.",
    gradientFrom: "#147a5c", gradientTo: "#2f7dbd",
    blocks: [
      { chapter: 1, ord: 0, type: "h", text: "Chapter One — Start with the room" },
      { chapter: 1, ord: 1, type: "p", text: "Safety during pregnancy often starts with ordinary things: floors that do not slip, medications that stay labeled, and routines that make fatigue less dangerous." },
      { chapter: 1, ord: 2, type: "p", text: "The best checklist is the one you can actually repeat when you are tired, busy, and already holding too much in your head." },
      { chapter: 2, ord: 0, type: "h", text: "Chapter Two — Know the warning signs" },
      { chapter: 2, ord: 1, type: "p", text: "Urgency feels calmer when you already know what counts as urgent. Keep emergency numbers visible and speak to a clinician early when symptoms change." },
    ],
  },
  {
    slug: "newborn-home-readiness", title: "Newborn Home Readiness", author: "Ayanda Dlamini",
    priceCents: 1299, categorySlug: "child-safety", ageGroup: "Newborn",
    blurb: "Prepare rooms, routines, and sleep spaces before the baby arrives home.",
    gradientFrom: "#2f7dbd", gradientTo: "#147a5c",
    blocks: [
      { chapter: 1, ord: 0, type: "h", text: "Chapter One — Reduce friction" },
      { chapter: 1, ord: 1, type: "p", text: "A safe home is easier when the basics live where you need them: changing supplies together, feeding tools clean, and pathways clear enough for tired steps at 2am." },
      { chapter: 1, ord: 2, type: "p", text: "Preparation is not about buying everything. It is about removing the little hazards that become big ones when everyone is exhausted." },
      { chapter: 2, ord: 0, type: "h", text: "Chapter Two — Sleep and supervision" },
      { chapter: 2, ord: 1, type: "p", text: "Keep the sleep space simple, cool, and predictable. Safety loves routine." },
    ],
  },
  {
    slug: "first-aid-quick-guide", title: "First Aid Quick Guide", author: "Nomsa Pillay",
    priceCents: 999, categorySlug: "first-aid", ageGroup: "All ages",
    blurb: "A fast-reference primer for burns, cuts, choking, and urgent escalation.",
    gradientFrom: "#f6b73c", gradientTo: "#d94b3d",
    blocks: [
      { chapter: 1, ord: 0, type: "h", text: "Chapter One — Stay useful" },
      { chapter: 1, ord: 1, type: "p", text: "First aid begins with calm. The goal is not to do everything. The goal is to do the next correct thing without making the situation worse." },
      { chapter: 1, ord: 2, type: "p", text: "Simple steps beat panic: clear the space, assess breathing, call early when risk is rising." },
      { chapter: 2, ord: 0, type: "h", text: "Chapter Two — Small kit, clear plan" },
      { chapter: 2, ord: 1, type: "p", text: "A labeled kit and one practiced response plan reduce hesitation when seconds matter." },
    ],
  },
  {
    slug: "home-emergency-prep", title: "Home Emergency Prep", author: "Kabelo Nene",
    priceCents: 1399, categorySlug: "emergency-preparedness", ageGroup: "Households",
    blurb: "Build a simple response plan for fire, outages, storms, and sudden evacuation.",
    gradientFrom: "#12312b", gradientTo: "#2f7dbd",
    blocks: [
      { chapter: 1, ord: 0, type: "h", text: "Chapter One — Fewer decisions later" },
      { chapter: 1, ord: 1, type: "p", text: "Emergency planning is mostly pre-deciding. Who grabs the documents? Where is the meeting point? Which neighbor has a key?" },
      { chapter: 1, ord: 2, type: "p", text: "Your best plan is written in language a child, grandparent, and panicked adult can all follow." },
      { chapter: 2, ord: 0, type: "h", text: "Chapter Two — Practice without fear" },
      { chapter: 2, ord: 1, type: "p", text: "Short, calm drills teach safety without turning the home into a place of dread." },
    ],
  },
  {
    slug: "food-and-hygiene-routines", title: "Food and Hygiene Routines", author: "Rethabile Modise",
    priceCents: 1199, categorySlug: "food-hygiene", ageGroup: "Families",
    blurb: "Keep kitchens, storage, and daily hygiene habits simple, clean, and repeatable.",
    gradientFrom: "#dff5ec", gradientTo: "#2f7dbd",
    blocks: [
      { chapter: 1, ord: 0, type: "h", text: "Chapter One — Clean beats perfect" },
      { chapter: 1, ord: 1, type: "p", text: "Healthy routines survive real life when they are simple enough to repeat after long workdays and messy mornings." },
      { chapter: 1, ord: 2, type: "p", text: "Separate raw and ready-to-eat food, label leftovers, and make handwashing easy, visible, and boring." },
      { chapter: 2, ord: 0, type: "h", text: "Chapter Two — Build the safe default" },
      { chapter: 2, ord: 1, type: "p", text: "The safest household habits are the ones that require the least remembering." },
    ],
  },
  {
    slug: "workplace-safety-startup-kit", title: "Workplace Safety Startup Kit", author: "Mpho Kheswa",
    priceCents: 1599, categorySlug: "workplace-safety", ageGroup: "Teams",
    blurb: "For small teams that need basic hazard awareness, response plans, and reporting habits.",
    gradientFrom: "#147a5c", gradientTo: "#12312b",
    blocks: [
      { chapter: 1, ord: 0, type: "h", text: "Chapter One — Safety is a system" },
      { chapter: 1, ord: 1, type: "p", text: "Most preventable incidents happen where nobody owns the obvious. Good workplaces make the obvious explicit." },
      { chapter: 1, ord: 2, type: "p", text: "Reporting, signage, and rehearsal matter more than polished policy decks nobody reads." },
      { chapter: 2, ord: 0, type: "h", text: "Chapter Two — Close the loop" },
      { chapter: 2, ord: 1, type: "p", text: "A hazard logged without follow-through is only better than silence for one afternoon." },
    ],
  },
  {
    slug: "safe-travels-a-toddler-s-car-safety-guide", title: "Safe Travels: A Toddler's Car Safety Guide", author: "The Safety Shelf",
    priceCents: 999, categorySlug: "child-safety", ageGroup: "Parents",
    blurb: "Ensure every journey is smooth and secure. This guide provides practical, calm, and actionable advice for installing car seats, managing toddler distractions, and maintaining safety routines during family road trips.",
    gradientFrom: "#2f7dbd", gradientTo: "#f6b73c",
    blocks: [
      { chapter: 1, ord: 0, type: "h", text: "Introduction: The Joy of Safe Travel" },
      { chapter: 1, ord: 1, type: "p", text: "Traveling with a toddler can be one of life's greatest adventures, but it also comes with new responsibilities. Proper preparation ensures that your family can focus on the journey rather than worrying about safety." },
      { chapter: 1, ord: 2, type: "p", text: "This guide is designed to provide you with calm, actionable steps to make every trip—from quick errands to long road trips—as secure and stress-free as possible." },
      { chapter: 2, ord: 0, type: "h", text: "The Perfect Fit: Understanding Car Seats" },
      { chapter: 2, ord: 1, type: "p", text: "Choosing the right car seat is the foundation of vehicle safety. It is essential to select a seat that matches your toddler's specific age, weight, and height requirements." },
      { chapter: 2, ord: 2, type: "p", text: "Regularly check your seat's installation to ensure it hasn't loosened over time due to vibrations or frequent use. A secure seat is a safe seat." },
      { chapter: 3, ord: 0, type: "h", text: "Securing the Passenger" },
      { chapter: 3, ord: 1, type: "p", text: "Once the seat is installed, the focus shifts to the harness. Always ensure the straps are adjusted to the correct height for your child's shoulders." },
      { chapter: 3, ord: 2, type: "p", text: "Use the \"pinch test\" to ensure a snug fit: if you can pinch any slack in the harness webbing at the shoulder, it needs to be tightened further." },
      { chapter: 4, ord: 0, type: "h", text: "Managing Distractions & Comfort" },
      { chapter: 4, ord: 1, type: "p", text: "A calm toddler often leads to a more focused driver. Keep essentials like water, healthy snacks, and favorite toys within easy reach to prevent the need for sudden stops or reaching while driving." },
      { chapter: 4, ord: 2, type: "p", text: "Use sunshades on side windows and baby mirrors to help you monitor your child without taking your eyes off the road for extended periods." },
      { chapter: 5, ord: 0, type: "h", text: "Safety Checklists for Every Trip" },
      { chapter: 5, ord: 1, type: "p", text: "Establishing a pre-departure routine helps prevent oversight. Check the harness, ensure the car seat is tight, and verify that all doors are securely latched." },
      { chapter: 5, ord: 2, type: "p", text: "Know your emergency plan. Familiarize yourself with where your first aid kit is located and identify safe places to pull over if an unexpected stop is needed." },
      { chapter: 6, ord: 0, type: "h", text: "Loading and Unloading Safely" },
      { chapter: 6, ord: 1, type: "p", text: "When arriving at your destination, especially in busy parking lots, always look for a safe area away from moving traffic to exit the vehicle." },
      { chapter: 6, ord: 2, type: "p", text: "Never move the vehicle until you have visually confirmed that the child is fully secured and the harness is properly adjusted." },
      { chapter: 7, ord: 0, type: "h", text: "Rear-Facing vs. Forward-Facing" },
      { chapter: 7, ord: 1, type: "p", text: "Rear-facing seats provide the best protection for the developing neck and spine of a toddler. Continue using a rear-facing seat for as long as the manufacturer's height and weight limits allow." },
      { chapter: 7, ord: 2, type: "p", text: "When it is time to transition to a forward-facing seat, do so gradually and ensure the new seat is correctly fitted for your child's current stage of growth." },
      { chapter: 8, ord: 0, type: "h", text: "The Car Safety Toolkit" },
      { chapter: 8, ord: 1, type: "p", text: "Your vehicle should be equipped with a small safety kit. This should include basic first aid supplies, a flashlight, and a portable phone charger." },
      { chapter: 8, ord: 2, type: "p", text: "Managing temperature is also key to safety. Keep a lightweight blanket and a small portable fan available to ensure your toddler remains comfortable in varying weather conditions." },
    ],
  },
];

export const seed = internalMutation({
  args: {},
  handler: async (ctx) => {
    if (await ctx.db.query("books").first()) return "already seeded";

    const categoryIdBySlug = new Map<string, Awaited<ReturnType<typeof ctx.db.insert<"categories">>>>();
    for (const category of CATEGORIES) {
      const id = await ctx.db.insert("categories", category);
      categoryIdBySlug.set(category.slug, id);
    }

    for (const book of BOOKS) {
      const categoryId = categoryIdBySlug.get(book.categorySlug);
      if (!categoryId) throw new Error(`Unknown categorySlug "${book.categorySlug}"`);

      const bookId = await ctx.db.insert("books", {
        slug: book.slug,
        title: book.title,
        author: book.author,
        priceCents: book.priceCents,
        status: "live",
        categoryId,
        ageGroup: book.ageGroup,
        originalLang: "en",
        blurb: book.blurb,
        kind: "guide",
        gradientFrom: book.gradientFrom,
        gradientTo: book.gradientTo,
      });

      for (const block of book.blocks) {
        await ctx.db.insert("bookBlocks", { bookId, ...block });
      }
    }

    return "seeded";
  },
});

export const createCoverUploadUrl = internalMutation({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const book = await ctx.db.query("books").withIndex("by_slug", (q) => q.eq("slug", slug)).unique();
    if (!book) throw new ConvexError(`Book "${slug}" not found; run seed:seed first`);
    return book.coverStorageId ? null : ctx.storage.generateUploadUrl();
  },
});

export const attachCover = internalMutation({
  args: { slug: v.string(), storageId: v.id("_storage") },
  handler: async (ctx, { slug, storageId }) => {
    const book = await ctx.db.query("books").withIndex("by_slug", (q) => q.eq("slug", slug)).unique();
    if (!book) throw new ConvexError(`Book "${slug}" not found`);
    await ctx.db.patch(book._id, { coverStorageId: storageId });
  },
});
