---
name: Touch carousel autoplay
description: Prevent touch-generated compatibility mouse events from leaving a carousel paused.
---

For autoplay carousels, pause/resume hover behavior only for pointer events whose `pointerType` is `mouse`. A touch can emit compatibility mouse-enter events without a matching mouse-leave, leaving autoplay paused after the touch ends.

**Why:** Mobile Chromium touch emulation reproduced a synthetic mouse-enter immediately after pointer-up; mouse-enter/leave handlers kept the autoplay pause state active indefinitely.

**How to apply:** Use pointer-enter/leave handlers that check `pointerType`, keep explicit pause/resume for touch start/end, and test a no-movement tap as well as a swipe.
