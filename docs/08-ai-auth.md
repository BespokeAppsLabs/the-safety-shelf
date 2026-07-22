# The Safety Shelf — AI Credentials & Sign-In

How the store owner authorizes the AI that powers the admin agent. Goal: let the
owner "sign in with ChatGPT" (like openclaw/opencode) **where legal**, and ship a
working, sanctioned path today.

## CRITICAL: identity vs usage — "Sign in with ChatGPT" is two products
The name covers two unrelated things. Conflating them is the main trap here.

| Flavor | What it is | Does the user's plan power OUR model calls? |
|---|---|---|
| **SSO login** | Standard OAuth (`openid/email/profile`). Identical in spirit to Sign in with Google/Apple. | **No** — you get identity only; you still need your own model credential |
| **Apps SDK** | Your app runs *inside* ChatGPT (MCP server); ChatGPT does the model calls on the user's plan | Only inside ChatGPT; no credential you can use in your own app |
| **Codex / "Login instead of BYOK" entitlement** | The flow that draws model usage from the user's ChatGPT plan for an external app | **Yes** — but Codex-scoped, experimental, ToS-barred for commercial |

**Consequence:** login and "who pays for the AI" are **separate problems**. The
sanctioned button gives us a *login*, not free model access. BYOK remains the
answer for the model. We may offer SSO-with-ChatGPT purely as an identity option
alongside BYOK — they are orthogonal, not a substitute for each other.

Refs: topmostads.com/sign-in-with-chatgpt · developers.openai.com/apps-sdk/build/auth.

## The three mechanisms

| Path | How it works | Sanctioned for a commercial product? | Billing |
|---|---|---|---|
| **A. Codex OAuth proxy** | ChatGPT "Sign in" OAuth → localhost proxy mimicking Codex CLI → Codex backend with the sub token | **No.** Plugins state: personal use only, "do not use to power commercial services." Bannable, fragile (Claude/Gemini killed theirs in Apr 2026). | User's ChatGPT plan |
| **B. Official "Login with ChatGPT"** | OpenAI's device-code flow (posted Jun 26 2026): button → user authorizes with a one-time code → usage draws from the user's ChatGPT plan, not our API bill | 🟡 Official but **experimental** — must confirm commercial/multi-user eligibility + terms | User's ChatGPT plan |
| **C. BYOK (API key)** | Owner pastes a provider API key; agent calls use it | ✅ Fully sanctioned, every provider | Owner's API account |

Refs: developers.openai.com/codex/auth · github.com/openai/codex/discussions/8338 ·
community.openai.com "Login with ChatGPT instead of bring your own token" · explainx LoginWithChatGPT.

## Decision
**Ship C (BYOK) now. Build a credential seam so B drops in when it's GA and
commercially licensed. Never ship A in the product.**

Rationale (Logic Maximizer):
- A is a ToS violation that risks the client's account — non-starter for a product we bill for.
- B is exactly the requested UX and is sanctioned, but too new to bet a launch on.
- C works today, is legal, and is **provider-agnostic**: OpenAI, DeepSeek, Kimi,
  GLM are all OpenAI-compatible, so one code path drives all four.

## The seam (one abstraction, two adapters)
The agent layer never sees a raw key — it asks a resolver for a ready client.

```ts
// convex/ai/credentials.ts  (conceptual)
type AiCredential =
  | { kind: "apiKey"; provider: Provider; apiKey: string; baseURL: string }
  | { kind: "chatgptOAuth"; accessToken: string; expiresAt: number };

interface CredentialProvider {
  resolve(ownerId: Id<"users">): Promise<ResolvedClient>; // returns an AI SDK model
}
```
- **`apiKeyAdapter`** (ship now): reads the owner's stored key → `createOpenAI({ baseURL, apiKey })`.
- **`chatgptOAuthAdapter`** (flagged, off): device-code token → official endpoint. Enable when B is GA.

Adding B later = one new adapter + a Settings toggle. Zero change to the tools.

## Flow C — BYOK setup (v1)
1. Admin → **Settings → AI Provider**: pick `OpenAI | DeepSeek | Kimi | GLM`, paste key.
2. Server action validates the key (one cheap test call), then stores it.
3. Every agent tool resolves the credential per call. Usage billed to the owner.

## Flow B — Login with ChatGPT (when eligible)
1. Settings → **"Connect ChatGPT"** → device-code screen.
2. Owner authorizes in ChatGPT; we receive an access token (+ refresh).
3. Store token; `chatgptOAuthAdapter` uses it; refresh on expiry. Usage on owner's plan.
4. Respect the plan's rate limits/model access; surface quota errors in the UI.

## Storage & security (non-negotiable)
- Keys/tokens stored in Convex **encrypted at rest** (envelope encryption; master
  key in Convex env, never in the repo). Single owner → one credential row.
- **Never** sent to the browser. All AI calls run server-side in Convex `action`s.
- Validate on save; store only last-4 for display. Rotate/revoke from Settings.
- OAuth tokens: store refresh token encrypted, access token short-lived in memory/cache.

## Rollout
- **Phase A (now):** BYOK for the four providers via the OpenAI-compatible path. Default provider TBD (see [07-agent-models](07-agent-models.md)).
- **Phase B (watch):** add `chatgptOAuth` adapter once OpenAI's official Login-with-ChatGPT is GA **and** its terms permit a commercial app. Same seam, feature-flagged.
- **Never:** the Codex-proxy hack.

## Open items to verify before building B
- Is OpenAI's "Login with ChatGPT" GA, and does it allow **commercial / multi-user** apps (not just personal dev)?
- Token lifetimes, refresh model, rate-limit behavior on a user's plan.
- Which models the subscription entitlement exposes (Codex-only vs general chat).

See [03-admin-agent](03-admin-agent.md) (tools) and [07-agent-models](07-agent-models.md) (which model the credential points at).
