---
name: Local browser auth state
description: The local Playwright Clerk session may exist on disk but no longer authenticate the preview host.
---

Authenticated browser checks can reach the sign-in page even when their configured storage-state file exists. Treat that as an expired or invalid Clerk session, not as a page-layout failure. Direct API calls can also remain unauthenticated until a page has initialized Clerk, and administrator routes additionally require the separate admin-password session.

**Why:** Browser storage states are time-sensitive and can become invalid independently of the test files, especially when the preview host or Clerk session changes.

**How to apply:** Refresh the local authenticated test state with the project's auth setup before diagnosing authenticated UI assertions. For direct requests, first open the authenticated app and await its `/api/admin/me` response; for protected administrator requests, log in with the administrator password in each browser context. Keep layout and interaction checks separate from auth setup work.