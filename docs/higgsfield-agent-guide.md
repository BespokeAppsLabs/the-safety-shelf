# Higgsfield generation guide for The Safety Shelf

Use this guide before spending Higgsfield credits through the app MCP connection.

## Source of truth

- MCP endpoint: `https://mcp.higgsfield.ai/mcp`.
- Auth: app-owned Higgsfield OAuth token stored in Convex as the image provider; no API key.
- Cost: Higgsfield credits are the billing truth. The app may show a rough credit estimate, but the MCP tool metadata/history must win when it exposes exact cost.
- Guardrail: do not submit paid Higgsfield runs until Settings → **Inspect Higgsfield tools** shows the concrete tool names and input schemas from the live app runtime.

## Product output types

1. **Cover image**: stays on the Details tab. Square, shelf-ready, title-led but no tiny unreadable body text.
2. **Page/chapter illustration**: Images tab. One image per chapter/page block; blank prompt uses the saved page text.
3. **Series/character art**: use Soul-style models only when the book needs the same person/mascot across many pages.
4. **Marketing video**: separate future workflow. Use product URL/book page plus 5-15s duration, target aspect ratio, and optional audio.

## Prompt frame

Always include:

```text
Output: [cover | page illustration | marketing video]
Book: [title]
Audience: children / parents / teachers / safety trainers
Page/chapter: [number + heading]
Scene goal: [one sentence]
Safety constraints: calm, educational, no gore, no panic, no medical/legal claims
Style: clean premium editorial illustration, warm lighting, diverse people, consistent palette
Composition: [square cover | 1:1 page | 16:9 launch | 9:16 reels]
Avoid: small text overlays, logos, distorted hands/faces, scary injury detail
Context: [short excerpt from page text]
```

## Model choice

- **Default image/page art**: Higgsfield Auto, Seedream 5, Flux 2, or GPT Image 2.
- **Precise edits / reference-aware images**: Nano Banana Pro or Higgsfield edit tools when exposed by MCP.
- **Consistent character/storybook**: Soul 2.0, Soul Cinema, or Soul Cast.
- **Launch/social video**: Seedance 2.0, Veo 3.1, Kling 3.0, Sora 2, WAN 2.6, Grok Imagine 1.5, Gemini Omni Flash, or Cinema Studio 3.0.
- **Product page to launch video**: use Higgsfield marketing video generator if exposed by MCP.

## Book-specific rules

- Safety books must look reassuring, not catastrophic.
- Page images should teach one idea per image; do not combine every paragraph into a cluttered poster.
- If every page needs an image, generate page-by-page from the Images tab and verify visual consistency before publishing.
- For multilingual variants, generate from original content unless the image depends on language-specific signage; avoid rendered text in the image.

## Pre-spend checklist

1. Image provider is Higgsfield MCP and test passes from Settings.
2. Inspect Higgsfield tools returns live tool schemas.
3. Model, aspect ratio, and estimate are visible before clicking Generate.
4. Prompt contains output type, page context, style, and safety constraints.
5. Save content after image changes if chapter/page structure was edited.
