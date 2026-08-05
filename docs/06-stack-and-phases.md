# The Safety Shelf — Stack & Build Phases

## Stack
| Concern | Choice |
|---|---|
| Frontend | Next.js App Router on Vercel |
| Backend | Convex |
| Auth | Clerk |
| Payments | Paystack hosted checkout (55/45 split group) |
| Text and image AI | One encrypted OpenRouter key |
| Audiobooks | ElevenLabs |
| Storage | Convex file storage |
| Social | Self-hosted Postiz |

## AI routing
- Chat and social copy use `deepseek/deepseek-v4-flash`, with
  `openai/gpt-5.6-luna` as the automatic failover and reasoning effort pinned
  to `medium`.
- Translations use `openai/gpt-5.6-luna`. `TRANSLATION_OPTIONS` deliberately
  sends no reasoning parameter because requiring it excluded compatible
  structured-output providers. No free model is used for text anywhere.
- Covers and chapter images use
  `google/gemini-3.1-flash-lite-image` through OpenRouter's Image API.
- Image bytes are stored in Convex and actual OpenRouter usage cost is returned
  after a completed generation.
- Image generation remains owner-triggered and agent-proposed before approval.
- ElevenLabs is unchanged and uses its own deployment credential.
