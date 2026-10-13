---
name: Preview E2E response timing
description: Replit preview behavior that affects authenticated Playwright response handling.
---

In authenticated Replit preview tests, a response body can become unavailable by the time a page-driven mutation has rendered its next state. Prefer asserting the response status and reading a server-owned identifier from the rendered state when the UI exposes it for testability.

**Why:** The preview proxy and client navigation can detach a completed response before a later `response.json()` or `response.body()` call, making an otherwise successful mutation look like a test failure.

**How to apply:** Keep API-response assertions for status and use a stable `data-testid`/data attribute for identifiers needed by subsequent browser steps. Use `context.request` for follow-up reads.