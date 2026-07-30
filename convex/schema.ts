// Schema plan and rationale: docs/05-data-model.md
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.string(),
    role: v.union(v.literal("owner"), v.literal("customer")),
  })
    .index("by_clerkId", ["clerkId"])
    .index("by_email", ["email"]),

  categories: defineTable({
    slug: v.string(),
    title: v.string(),
    icon: v.optional(v.string()),
    description: v.optional(v.string()),
    sortOrder: v.number(),
  }).index("by_slug", ["slug"]),

  books: defineTable({
    slug: v.string(),
    title: v.string(),
    author: v.string(),
    priceCents: v.number(),
    status: v.union(v.literal("draft"), v.literal("live"), v.literal("archived")),
    categoryId: v.id("categories"),
    ageGroup: v.string(),
    originalLang: v.string(),
    blurb: v.string(),
    kind: v.optional(v.union(v.literal("guide"), v.literal("storybook"))),
    coverStorageId: v.optional(v.id("_storage")),
    epubStorageId: v.optional(v.id("_storage")),
    pdfStorageId: v.optional(v.id("_storage")),
    // Demo and generated covers live in Convex storage; the local demo-cover
    // sources are retained under docs/demo-book-covers for clean reseeds.
    gradientFrom: v.optional(v.string()),
    gradientTo: v.optional(v.string()),
    // Audiobook generation state (ElevenLabs). Undefined = none generated.
    audioStatus: v.optional(v.union(v.literal("generating"), v.literal("ready"), v.literal("failed"))),
  })
    .index("by_slug", ["slug"])
    .index("by_status", ["status"])
    .index("by_category", ["categoryId"]),

  // Singleton (one row). Holds the currency the owner actually prices books in
  // — books.priceCents is minor units OF THIS currency, never assumed to be
  // USD. Nothing in the app hardcodes a currency; if this row is missing,
  // prices are not rendered until the owner sets one in Admin → Settings.
  storeSettings: defineTable({
    baseCurrency: v.string(),
  }),

  // Owner-managed display rates: 1 unit of baseCurrency = `rate` units of
  // `currency`. Used for storefront display only — orders are still recorded in
  // base-currency minor units, so a rate edit never rewrites past revenue.
  fxRates: defineTable({
    currency: v.string(),
    rate: v.number(),
    updatedAt: v.number(),
  }).index("by_currency", ["currency"]),

  bookBlocks: defineTable({
    bookId: v.id("books"),
    chapter: v.number(),
    ord: v.number(),
    type: v.union(v.literal("h"), v.literal("p"), v.literal("img")),
    text: v.optional(v.string()),
    imgStorageId: v.optional(v.id("_storage")),
  }).index("by_book", ["bookId", "chapter", "ord"]),

  // ElevenLabs voice catalog, seeded from their /v1/voices API by
  // convex/voices/actions/sync.ts. Global (not per-owner) — it's a picklist for
  // audiobook generation. previewUrl is a short sample the UI can play.
  voices: defineTable({
    voiceId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    previewUrl: v.optional(v.string()),
  }).index("by_voiceId", ["voiceId"]),

  // One narrated MP3 per chapter, produced by the ElevenLabs pipeline
  // (convex/audiobook.ts) and stored in Convex file storage. Full-replaced on
  // each regeneration. Kept separate from books so re-narration never touches
  // the book row beyond its audioStatus flag.
  bookAudio: defineTable({
    bookId: v.id("books"),
    chapter: v.number(),
    storageId: v.id("_storage"),
    chars: v.number(),
    model: v.string(),
    voiceId: v.string(),
    // Language of this narration. Optional for back-compat: rows written before
    // multi-language audio have no lang and are treated as the book's original.
    lang: v.optional(v.string()),
  }).index("by_book", ["bookId"]),

  bookVariants: defineTable({
    bookId: v.id("books"),
    lang: v.string(),
    status: v.union(v.literal("draft"), v.literal("live")),
    title: v.optional(v.string()),
    blurb: v.optional(v.string()),
    // New AI output stays out of reading/audio until the owner saves it.
    // Undefined is intentionally treated as saved for legacy rows.
    isSaved: v.optional(v.boolean()),
    // Per-language audiobook state (the original's lives on books.audioStatus).
    audioStatus: v.optional(v.union(v.literal("generating"), v.literal("ready"), v.literal("failed"))),
  })
    .index("by_book_lang", ["bookId", "lang"])
    .index("by_book", ["bookId"]),

  variantBlocks: defineTable({
    variantId: v.id("bookVariants"),
    chapter: v.number(),
    ord: v.number(),
    type: v.union(v.literal("h"), v.literal("p"), v.literal("img")),
    text: v.optional(v.string()),
    imgStorageId: v.optional(v.id("_storage")),
  }).index("by_variant", ["variantId", "chapter", "ord"]),

  orders: defineTable({
    userId: v.id("users"),
    stripeSessionId: v.string(),
    stripePaymentIntentId: v.optional(v.string()),
    totalCents: v.number(),
    status: v.union(v.literal("paid"), v.literal("refunded")),
  })
    .index("by_user", ["userId"])
    .index("by_stripeSession", ["stripeSessionId"]),

  orderItems: defineTable({
    orderId: v.id("orders"),
    bookId: v.id("books"),
    priceCents: v.number(),
  })
    .index("by_order", ["orderId"])
    .index("by_book", ["bookId"]),

  entitlements: defineTable({
    userId: v.id("users"),
    bookId: v.id("books"),
    orderId: v.id("orders"),
    grantedAt: v.number(),
    revokedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_user_book", ["userId", "bookId"])
    .index("by_book", ["bookId"]),

  aiCredentials: defineTable({
    ownerId: v.id("users"),
    purpose: v.optional(v.union(v.literal("text"), v.literal("image"))),
    // Retired literals stay readable for deployed legacy rows. Only OpenRouter
    // is active at runtime.
    provider: v.union(v.literal("openrouter"), v.literal("openai"), v.literal("deepseek"), v.literal("kimi"), v.literal("glm"), v.literal("ollama"), v.literal("stability"), v.literal("higgsfield")),
    kind: v.union(v.literal("apiKey"), v.literal("chatgptOAuth"), v.literal("mcp")),
    encryptedKey: v.optional(v.string()),
    keyLast4: v.optional(v.string()),
    baseURL: v.optional(v.string()),
    model: v.optional(v.string()),
    encryptedRefreshToken: v.optional(v.string()),
    accessTokenExpiresAt: v.optional(v.number()),
    // OAuth client_id from dynamic registration — required to refresh the token.
    clientId: v.optional(v.string()),
    isActive: v.boolean(),
    validatedAt: v.optional(v.number()),
  })
    .index("by_owner", ["ownerId"])
    .index("by_owner_purpose", ["ownerId", "purpose"]),


  socialAccounts: defineTable({
    platform: v.union(
      v.literal("instagram"), v.literal("facebook"), v.literal("x"),
      v.literal("tiktok"), v.literal("linkedin"),
    ),
    postizChannelId: v.string(),
    status: v.union(v.literal("connected"), v.literal("disconnected"), v.literal("pending_review")),
    connectedAt: v.optional(v.number()),
  }).index("by_platform", ["platform"]),

  socialPosts: defineTable({
    bookId: v.id("books"),
    platform: v.union(
      v.literal("instagram"), v.literal("facebook"), v.literal("x"),
      v.literal("tiktok"), v.literal("linkedin"),
    ),
    postizPostId: v.optional(v.string()),
    status: v.union(v.literal("draft"), v.literal("scheduled"), v.literal("published"), v.literal("failed")),
    content: v.string(),
    mediaStorageId: v.optional(v.id("_storage")),
    scheduledAt: v.optional(v.number()),
    publishedAt: v.optional(v.number()),
  })
    .index("by_book", ["bookId"])
    .index("by_status", ["status"]),

  agentActions: defineTable({
    tool: v.string(),
    args: v.any(),
    status: v.union(
      v.literal("proposed"), v.literal("approved"), v.literal("rejected"),
      v.literal("executed"), v.literal("failed"),
    ),
    proposedAt: v.number(),
    decidedAt: v.optional(v.number()),
    decidedBy: v.optional(v.id("users")),
    result: v.optional(v.any()),
    relatedBookId: v.optional(v.id("books")),
  })
    .index("by_tool", ["tool"])
    .index("by_status", ["status"])
    .index("by_proposedAt", ["proposedAt"]),

  // Versioned system prompt for the agent — append-only. Editing never
  // mutates a row; it inserts a new version and deactivates the old one, so
  // prior prompts stay inspectable/revertible. See convex/agentPrompts.ts.
  agentPrompts: defineTable({
    version: v.number(),
    content: v.string(),
    note: v.optional(v.string()),
    isActive: v.boolean(),
    createdBy: v.id("users"),
  })
    .index("by_version", ["version"])
    .index("by_active", ["isActive"]),

  // Owner's saved chat sessions with the store agent. Messages (and the
  // generative-UI cards each assistant turn produced) are stored inline on the
  // session doc — simplest thing that works for a single-owner demo.
  // ponytail: inline messages array; split into a messages table only if a
  // session ever approaches Convex's 1MB document limit.
  agentChats: defineTable({
    ownerId: v.id("users"),
    title: v.string(),
    messages: v.array(
      v.object({
        role: v.union(v.literal("user"), v.literal("assistant")),
        content: v.string(),
        cards: v.optional(v.array(v.object({ component: v.string(), props: v.any() }))),
        // Links an automatic action outcome to its proposal card and prevents
        // duplicate failure notices when a client retries a request.
        actionId: v.optional(v.id("agentActions")),
        // A turn the owner stopped mid-flight: kept for the human-facing thread
        // (get) but excluded from the model's history (getForOwner), so the
        // agent never sees — or tries to resume — an abandoned request.
        stopped: v.optional(v.boolean()),
      }),
    ),
    updatedAt: v.number(),
    // Soft delete: set when the owner removes a conversation. The row and its
    // messages stay in the DB; `list` just hides deleted sessions.
    deletedAt: v.optional(v.number()),
  }).index("by_owner", ["ownerId"]),

  // Cancellation channel for an in-flight agent run. The sendMessage action
  // polls the matching row's `cancelled` flag and, when set, aborts the LLM
  // call server-side (generateText abortSignal) — so a stop actually halts
  // generation instead of just discarding the reply. runId is a client-minted
  // uuid so cancel can arrive before the row is even created. Rows are deleted
  // when the run ends. ponytail: ~500ms poll; fine for a single owner.
  agentRuns: defineTable({
    runId: v.string(),
    ownerId: v.id("users"),
    cancelled: v.boolean(),
  }).index("by_runId", ["runId"]),

  agentLogs: defineTable({
    role: v.union(
      v.literal("orchestrator"), v.literal("writer"), v.literal("reviewer"),
      v.literal("translator"), v.literal("social"), v.literal("analyst"),
    ),
    model: v.string(),
    tool: v.optional(v.string()),
    inputTokens: v.number(),
    outputTokens: v.number(),
    latencyMs: v.number(),
    costCents: v.optional(v.number()),
    status: v.union(v.literal("ok"), v.literal("error")),
    errorMessage: v.optional(v.string()),
    relatedActionId: v.optional(v.id("agentActions")),
  })
    .index("by_role", ["role"])
    .index("by_status", ["status"]),

  eventLogs: defineTable({
    type: v.string(),
    userId: v.optional(v.id("users")),
    sessionId: v.string(),
    path: v.string(),
    metadata: v.optional(v.any()),
  })
    .index("by_type", ["type"])
    .index("by_user", ["userId"])
    .index("by_session", ["sessionId"]),

  purchaseBehaviourLogs: defineTable({
    bookId: v.id("books"),
    userId: v.optional(v.id("users")),
    sessionId: v.string(),
    stage: v.union(
      v.literal("viewed"), v.literal("sample_opened"),
      v.literal("checkout_started"), v.literal("purchased"), v.literal("abandoned"),
    ),
  })
    .index("by_book", ["bookId"])
    .index("by_user", ["userId"])
    .index("by_stage", ["stage"])
    .index("by_session", ["sessionId"]),
});
