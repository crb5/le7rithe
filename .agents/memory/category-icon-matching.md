---
name: Category icon matching
description: Durable rule for resolving marketplace category icons from multilingual slugs and titles.
---

More specific category terms must be checked before broad terms when resolving icons. In particular, spare-parts titles can contain machinery words, so matching machinery first mislabels them. Arabic plural forms also need explicit coverage when they do not contain the singular substring.

**Why:** Catalog labels combine category concepts and vary by language; first-match ordering and exact script forms can otherwise produce a plausible but wrong icon.

**How to apply:** When adding a category matcher, test its Arabic, French, and English catalog names and place it before any broader matcher that can occur in the same title.

Keep listing-photo fallback symbols in their own category map rather than changing the existing category-navigation icon resolver.

**Why:** Image placeholders need specific machinery symbols such as harvesters and plows, while fallback-only work should not restyle category browsing.

**How to apply:** Extend the listing-image placeholder map for image-slot changes; update shared category-navigation icons only when that UI is also in scope.