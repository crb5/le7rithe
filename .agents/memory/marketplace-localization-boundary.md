---
name: Marketplace localization boundary
description: Keep translated marketplace labels display-only and preserve existing data and routes.
---

Translate known place names, fixed option labels, and category names at the display layer. Preserve the source values stored in existing listings, the existing filtering behavior, and URL/query contracts. Unknown custom place names should remain in Arabic rather than displaying translation keys.

**Why:** Localization is a presentation change; rewriting listing values or changing filters and links can break existing records and user workflows.

**How to apply:** When localizing marketplace screens, reuse display helpers and category translations without changing API/database contracts, filtering, or routing. Keep the location field when removing a duplicate region control.
