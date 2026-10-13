---
name: Listing image preservation
description: Product constraints on new-image optimization, legacy photos, category placeholders and protected image access.
---

Image optimization applies to new uploads only. Keep each raw upload until both private WebP derivatives are stored, then remove only that upload source. Do not backfill or overwrite existing display photos; retain the gold-on-green category placeholders and full-size detail view.

**Why:** The user requires existing listing media to remain unchanged while new uploads lose their redundant, metadata-bearing source after successful processing.

**How to apply:** Create separate derivatives for new uploads and delete the raw source only after both derivatives succeed. Active listings keep their existing display media; physically delete managed listing photos when the owner deletes the listing or account. Do not infer which legacy uploads belong to a listing. Any one-time legacy cleanup must be development-only, dry-run by default, and require a confirmed backup before apply. Derivatives must inherit the original listing's access checks; optimization must not weaken draft/private media access or bypass publication rules. A missing thumbnail should fall back to the original image, not to a category placeholder while a real photo is available.

On mobile listing details, show the full photo inside a fixed-ratio frame; confine horizontal scrolling to the thumbnail row and prevent it from widening the page.

**Why:** The user explicitly requires tall and wide listing photos to remain fully visible without horizontal page overflow.

**How to apply:** Keep gallery/grid children shrinkable and use containment for the main photo; do not hide page overflow as a substitute for containing the thumbnail strip.
