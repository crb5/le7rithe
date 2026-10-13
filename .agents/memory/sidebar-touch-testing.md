---
name: Sidebar touch testing
description: Limits of Chromium touch emulation when validating mobile Safari behavior.
---

Chromium touch emulation can verify basic mobile interactions but does not confirm that a scroll-lock change works in iPhone Safari. The current test environment has Chromium only and no physical iPhone.

**Why:** Browser engines and iOS touch scrolling can differ, so passing emulated tests is not proof of Safari behavior.

**How to apply:** For changes that affect mobile touch scrolling, report this limitation and arrange a real iPhone Safari or WebKit check before treating platform coverage as complete.