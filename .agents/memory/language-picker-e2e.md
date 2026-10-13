---
name: Language picker browser tests
description: Avoid flaky same-locale and close/reopen sequences when testing language selection.
---

For language-picker regression tests, inspect the active locale and its checked state, then choose a different locale from the menu that is already open before testing another switch.

**Why:** In Chromium, closing the menu with Escape or selecting the already-active locale before reopening repeatedly left the next option unavailable. Selecting a real locale change from the open menu, then switching again, passed on desktop and narrow viewports.

**How to apply:** Test Arabic as the initial state, choose French directly from the open menu, then exercise a second switch to English through the trigger.