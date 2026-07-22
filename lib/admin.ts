// ADMIN_STATS, ADMIN_QUEUE, SOCIAL_STATUS, and AGENT_ACTIONS below are still
// mock — they depend on the agent tool-calling pipeline and Postiz
// integration (Phase 2/3, docs/06-stack-and-phases.md), not yet built.
// AdminBooksScreen's catalog table is wired to real Convex data instead of
// this file's old ADMIN_BOOK_ROWS.

export const ADMIN_STATS = [
  { label: "Live guides", value: "12", detail: "8 published, 4 queued for review." },
  { label: "Monthly revenue", value: "$3.8k", detail: "Mock total from the current seeded catalog." },
  { label: "Library unlocks", value: "94", detail: "Demo entitlement trend for returning readers." },
  { label: "Pending approvals", value: "5", detail: "Drafts and social posts waiting for confirmation." },
];

export const ADMIN_QUEUE = [
  { title: "Pregnancy home safety checklist", body: "Ready for final fact review and publish approval.", status: "Needs approval", variant: "warning" as const },
  { title: "Toddler choking response quick guide", body: "Cover and EPUB export completed.", status: "Draft ready", variant: "info" as const },
  { title: "Household chemical storage guide", body: "Social caption and storefront blurb proposed.", status: "Scheduled", variant: "success" as const },
];

export const SOCIAL_STATUS = [
  { platform: "Instagram", body: "Connected through the future Postiz channel slot.", status: "Ready", variant: "success" as const },
  { platform: "Facebook", body: "Business account review still needed before live posting.", status: "Review", variant: "warning" as const },
  { platform: "X", body: "Posting stays budget-gated because of paid API costs.", status: "Budgeted", variant: "info" as const },
];

export const AGENT_ACTIONS = [
  {
    id: "draft-guide",
    tool: "writeBook",
    title: "Pregnancy safety starter guide",
    body: "Draft structured chapters for first trimester risks, clinic prep, and emergency signs.",
    component: "BookDraftCard",
    preview: "Returns title, chapter count, and a short sample for approval.",
    status: "Pending",
  },
  {
    id: "social-post",
    tool: "generateSocialPost",
    title: "Childproofing week campaign",
    body: "Generate a calm, practical social post with one checklist and one CTA.",
    component: "SocialPostPreview",
    preview: "Returns channel copy plus an owner-facing approval action.",
    status: "Pending",
  },
];
