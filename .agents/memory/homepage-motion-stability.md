---
name: Homepage motion stability
description: The marketplace home route should avoid entrance animations that shift or fade the whole page on iOS browsers.
---

Keep page, section, and staggered entrance animations disabled on the marketplace home route. The user confirmed that this stopped the whole-page jump in both iOS Safari and Chrome; other route transitions and interactive tap feedback can remain.

**Why:** Top-level layout and scroll measurements stayed stable while users still saw the whole page jump, so opacity/entrance motion was the remaining cause.

**How to apply:** When changing home-page motion, verify a cold open on iOS Safari and Chrome before enabling page-wide fades or staggered reveals.
