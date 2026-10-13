---
name: Marquee interaction testing
description: Browser interaction constraints for the featured marketplace carousel.
---

Interactive carousel tests must scroll the target into the viewport before dispatching mouse or touch coordinates. Chromium may cancel pointer events when a drag starts over links, so the carousel should disable native drag behavior and keep a dedicated mouse path alongside touch/pointer handling.

**Why:** A visible DOM element can still be below the viewport, causing coordinate-based tests to send events outside it. Chromium also emitted pointercancel before mouseup for link-backed cards, leaving the carousel stuck in its dragging state.

**How to apply:** Use `scrollIntoViewIfNeeded()` in coordinate-based regression setup, keep horizontal carousel surfaces on `touch-action: none`, prevent native dragstart, and verify both touch and mouse release states.