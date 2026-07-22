---
name: headless-chrome-screenshot-gotcha
description: Chrome headless --window-size does NOT set the CSS layout viewport; use CDP device emulation for true mobile screenshots
metadata: 
  node_type: memory
  type: reference
  originSessionId: d5f66691-7c59-4f2b-9d15-ee62f3929dcd
---

Chrome headless `--window-size=390,900 --screenshot` does **not** set the CSS layout viewport — the page renders at a wider default (~485px) and the screenshot just crops to 390, making content look "cut off" / falsely overflowing. This wasted time chasing a non-existent mobile overflow bug.

**Correct way to screenshot/measure a true mobile viewport:** drive Chrome via CDP (`--remote-debugging-port`), then:
- `Emulation.setDeviceMetricsOverride {width:390,height:844,deviceScaleFactor:2,mobile:true}`
- measure `document.documentElement.scrollWidth` vs `clientWidth` (equal ⇒ no overflow)
- `Page.captureScreenshot`

Node 22 has a **built-in global `WebSocket`**, so a tiny `.mjs` script can speak CDP with zero deps (no puppeteer/playwright install needed). Pattern: `fetch(http://localhost:PORT/json)` → open `webSocketDebuggerUrl` → send `{id,method,params}` frames.

PDF from HTML also works dep-free: `chrome --headless --no-pdf-header-footer --print-to-pdf=out.pdf file://...` (add `-webkit-print-color-adjust:exact` + `@page{margin:0}` for full-bleed dark themes).
