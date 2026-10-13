---
name: Listing photo fallback
description: Product rule for choosing real listing photos before category placeholders.
---

Every listing surface should show a real photo whenever at least one provided photo source loads. Consider nonblank entries from the image array in order, then the legacy single-image URL; show the category placeholder only when no source loads.

**Why:** The user explicitly prioritized preserving real listing photos over decorative category placeholders.

**How to apply:** Keep changes limited to source selection and load-error fallback across listing surfaces. Preserve existing image-slot layouts and placeholder styling; do not modify unrelated UI.