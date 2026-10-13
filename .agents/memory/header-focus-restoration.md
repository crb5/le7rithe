---
name: Drawer focus restoration
description: Accessible focus handoff when closing the marketplace drawer while its header hides on scroll.
---

When closing the mobile navigation drawer, focus its opener before clearing the open state. The open drawer pins the header in the visible state, so the opener remains focusable during the handoff.

**Why:** Focusing after the drawer closes can target an inert header when the page is scrolled down or the scroll-direction state has not caught up yet.

**How to apply:** Route Escape, close-button, overlay, and navigation-link closures through one handler that focuses the opener before closing. Keep browser checks for focus restoration while scrolled.

When an Escape key closes a modal nested inside the drawer, stop propagation after preventing the browser default. Otherwise the document-level drawer handler receives the same key and closes the background drawer too.

**Why:** Closing both layers can make the modal's focus-restoration target inert, breaking keyboard navigation even when the dialog itself handles Escape correctly.

**How to apply:** Check overlays against document-level Escape listeners and keep the event contained at the active modal boundary.