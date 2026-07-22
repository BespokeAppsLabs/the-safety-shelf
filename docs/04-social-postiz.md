# The Safety Shelf — Social Publishing

**Postiz** is an open-source, self-hostable social scheduler that ships the
OAuth "connect your accounts" flow *and* a REST API. We run our own instance;
the admin agent talks to it. This is the "log into my socials once, then post on
my behalf" service the owner asked for.

## Why Postiz
- Free, self-hosted (Docker); we own the infra and the tokens.
- Handles the per-platform OAuth dance (IG/FB/X/TikTok/LinkedIn/…) so we don't
  build four separate integrations.
- Public API for listing connected channels + creating/scheduling posts.
- Fallback if we don't want ops: **Ayrshare** (managed, ~$149/mo) — same shape
  of integration, swap the client.

## Architecture
```
Admin dashboard ──REST──▶ Postiz instance ──OAuth/API──▶ IG · FB · X · TikTok
   (our app)      API key      (self-hosted)               (owner's accounts)
```
Postiz is the token vault + fan-out engine. Our app never holds raw social
tokens — it holds one Postiz API key. Postiz runs as a sibling container/service;
covered in [06-stack-and-phases](06-stack-and-phases.md).

## Managed from the admin dashboard
A **Social** panel in the admin, backed by these agent tools (Convex `action`s calling the Postiz API):

| Capability | How | UI |
|---|---|---|
| **Connect an account** | Link out to the Postiz connect flow (it owns the registered platform apps + OAuth redirect). Owner authorizes; Postiz stores the channel. | "Connect" buttons per platform |
| **See connected accounts** | `GET /integrations` (Postiz API) → list channels + status | `SocialAccountsCard` |
| **Draft a post** | `generateSocialPost` (LLM copy + image; video for TikTok) — propose-then-confirm | `SocialPostPreview` |
| **Publish / schedule** | `POST /posts` to Postiz with selected channels + media | Approve button → posted |
| **Disconnect** | Delete the integration via API | account row action |

> Connecting accounts is the one step best left to Postiz's own UI — it holds the
> platform app credentials and redirect URIs. Everything after (list, draft,
> publish, disconnect) runs through the API from our dashboard.

## Post flow (propose-then-confirm)
1. Owner: "Announce the new book on IG, FB and X."
2. `generateSocialPost(bookId, ["instagram","facebook","x"])` → per-platform copy + cover image.
3. Renders `SocialPostPreview` with an **Approve & Publish** button.
4. On click → `publishSocial` → `POST /posts` to Postiz → fans out.

## Platform reality (repeat from [01-scope-v1](01-scope-v1.md))
- **X** charges per post. **TikTok** needs an audit (private until approved) and
  wants a **video** asset. **Meta** needs a Business account + app review.
- v1 promise: **IG / FB / X now, TikTok once approved.**
