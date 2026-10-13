---
name: Header locale ordering
description: Separate physical header layout from RTL/LTR text direction when positioning marketplace controls.
---

Keep marketplace and authentication header containers physically LTR, but place the identity group on the left in Arabic and right in French/English. Place tools on the opposite side. Apply locale direction only to text and direction-aware content such as navigation.

**Why:** The user explicitly requested locale-specific physical ordering, superseding the previously selected fixed LTR side order. The outer container must stay LTR so its group positions do not flip automatically with RTL text.

**How to apply:** Keep identity first and tools second in the DOM; use `row` for Arabic and `row-reverse` for French/English. Keep the menu trigger at the outer edge of its tool group, align the dropdown to the corresponding button edge, preserve locale flags and reduced-motion support, and reuse the same language picker on auth pages.