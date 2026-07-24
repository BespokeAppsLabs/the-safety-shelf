# The Safety Shelf — OpenRouter Routing

All text AI uses the owner's encrypted OpenRouter key and
`google/gemma-4-26b-a4b-it:free`. The server does not configure a paid text
fallback. The returned model is recorded for agent chat. Settings validates the
same free-only route.

Agent turns that expose tools require OpenRouter to route only to a provider
that supports every supplied parameter, and allow one tool call at a time. This
prevents a draft request from being sent to a provider that ignores tool calls.

Cover and chapter art use the fixed OpenRouter image model
`google/gemini-3.1-flash-lite-image`. Generation responses carry actual cost;
there are no pre-generation price estimates or model selectors.

ElevenLabs remains independent for audiobook narration.
