import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { viewerQuery, viewerMutation, requireOwner } from "./lib/auth";

const platformArg = v.union(
  v.literal("instagram"), v.literal("facebook"), v.literal("x"),
  v.literal("tiktok"), v.literal("linkedin"),
);
const statusArg = v.union(
  v.literal("draft"), v.literal("scheduled"), v.literal("published"), v.literal("failed"),
);

// Connected Postiz channels. Empty until the owner connects accounts through
// Postiz's own OAuth UI (it owns the platform app credentials).
export const listAccounts = viewerQuery({
  args: {},
  handler: async (ctx) => {
    requireOwner(ctx.viewer);
    return ctx.db.query("socialAccounts").collect();
  },
});

export const listPosts = viewerQuery({
  args: { bookId: v.optional(v.id("books")) },
  handler: async (ctx, { bookId }) => {
    requireOwner(ctx.viewer);
    const rows = bookId
      ? await ctx.db.query("socialPosts").withIndex("by_book", (q) => q.eq("bookId", bookId)).collect()
      : await ctx.db.query("socialPosts").collect();
    rows.sort((a, b) => b._creationTime - a._creationTime);
    return Promise.all(rows.map(async (row) => {
      const book = await ctx.db.get(row.bookId);
      return {
        ...row,
        bookTitle: book?.title ?? "(deleted book)",
        mediaUrl: row.mediaStorageId ? await ctx.storage.getUrl(row.mediaStorageId) : null,
      };
    }));
  },
});

export const deletePost = viewerMutation({
  args: { postId: v.id("socialPosts") },
  handler: async (ctx, { postId }) => {
    requireOwner(ctx.viewer);
    const post = await ctx.db.get(postId);
    if (!post) throw new ConvexError("Post not found");
    if (post.status === "published") throw new ConvexError("Published posts can't be deleted here — remove them in Postiz.");
    await ctx.db.delete(postId);
  },
});

// ---- internal, called from socialActions.ts (node runtime) ----

export const bookForSocial = internalQuery({
  args: { bookId: v.id("books") },
  handler: async (ctx, { bookId }) => {
    const book = await ctx.db.get(bookId);
    if (!book) return null;
    return {
      title: book.title,
      author: book.author,
      blurb: book.blurb,
      slug: book.slug,
      priceCents: book.priceCents,
      coverStorageId: book.coverStorageId ?? null,
    };
  },
});

export const insertPost = internalMutation({
  args: {
    bookId: v.id("books"),
    platform: platformArg,
    content: v.string(),
    mediaStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => ctx.db.insert("socialPosts", { ...args, status: "draft" }),
});

export const updatePostContent = internalMutation({
  args: { postId: v.id("socialPosts"), content: v.string() },
  handler: async (ctx, { postId, content }) => {
    const post = await ctx.db.get(postId);
    if (!post) throw new ConvexError("Post not found");
    await ctx.db.patch(postId, { content, status: "draft", postizPostId: undefined, publishedAt: undefined });
  },
});

export const markPost = internalMutation({
  args: { postId: v.id("socialPosts"), status: statusArg, postizPostId: v.optional(v.string()) },
  handler: async (ctx, { postId, status, postizPostId }) => {
    await ctx.db.patch(postId, {
      status,
      ...(postizPostId ? { postizPostId } : {}),
      ...(status === "published" ? { publishedAt: Date.now() } : {}),
    });
  },
});

export const getPost = internalQuery({
  args: { postId: v.id("socialPosts") },
  handler: async (ctx, { postId }) => ctx.db.get(postId),
});
