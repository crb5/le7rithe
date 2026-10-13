---
name: Payment review E2E authentication
description: A fresh Clerk browser session can still lack local administrator authorization.
---

Payment-review browser setup must validate both Clerk session establishment and the application's local administrator role before running queue or transition checks.

**Why:** The API prefers an existing local user record over Clerk role claims, so a valid ticket can produce a session whose admin requests return 403.

**How to apply:** Treat a successful ticket redirect as authentication only; verify the generated admin state against the app's admin identity endpoint and fail setup with the account mapping diagnosis when it is not admin or moderator.