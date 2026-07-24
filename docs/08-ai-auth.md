# The Safety Shelf — AI Credentials

The owner supplies one OpenRouter API key in Admin Settings. It is validated
against OpenRouter's authenticated key-information endpoint (not a model call),
encrypted at rest in Convex, and only used by server-side Convex actions.

That single active credential serves agent chat, translations, social copy, and
cover/chapter image generation. Saving a new key deactivates legacy provider
rows without deleting them, preserving deployment compatibility. Settings only
shows the key's final four characters and connection state.

The encryption master key is `AI_CREDENTIALS_ENCRYPTION_KEY` in the Convex
deployment environment. It is mandatory before a key can be saved.

Agent web research uses a separate `FIRECRAWL_API_KEY` in the Convex deployment
environment. It is never exposed as a `NEXT_PUBLIC_*` browser variable.

ElevenLabs credentials and audiobook generation remain separate.
