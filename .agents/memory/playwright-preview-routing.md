---
name: Playwright preview routing
description: Use the proxied Replit preview host when browser tests need multiple artifact services.
---

Browser E2E tests for a multi-service web artifact should use the Replit development preview domain rather than connecting directly to the frontend workflow's localhost port. The direct port can bypass the shared route used to forward API requests to the API-server artifact.

**Why:** Pointing Playwright at the local Vite port produced an invalid response for category requests, while the same app loaded correctly through the preview.

**How to apply:** Set `E2E_BASE_URL` to `https://$REPLIT_DEV_DOMAIN` when running browser tests that exercise frontend API calls. Use the local port only for checks that do not depend on cross-artifact routing.