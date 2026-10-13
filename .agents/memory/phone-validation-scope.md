---
name: Phone validation scope
description: Project scope rule for phone and WhatsApp validation changes on Le7rithe.com.
---

When changing Mauritanian phone-number validation, limit changes to the existing phone and WhatsApp inputs and their corresponding API boundaries. Reject unsupported first national digits as users type or paste, not only at submission. Preserve unrelated marketplace behavior, existing formatting and links, and unchanged legacy listing numbers.

**Why:** The user explicitly repeated that no other site functionality should change and clarified that forbidden prefixes must be stopped in the input, not merely rejected when the form is submitted.

**How to apply:** Before editing, enumerate all existing phone-entry surfaces and matching server writes; enforce the prefix rule on typing/paste and again at server boundaries, while preserving unchanged legacy values.