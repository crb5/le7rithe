---
name: Performance measurement constraints
description: Guardrails for performance checks on the agricultural marketplace.
---

Do not create fake or mock marketplace records to benchmark or demonstrate performance. Measure against existing data, and clearly state when the development dataset is too small to represent production scale.

**Why:** The user explicitly required real data only; adding synthetic listings would make both measurements and the marketplace display misleading.

Keep before/after comparisons on the same measurement tool and server settings, except for the optimization being evaluated. Distinguish local build measurements from published/CDN measurements.

**Why:** The earlier mobile LCP was collected with Playwright, while Lighthouse produces a different baseline even with matching device/network conditions. The original local benchmark server also did not compress responses; this does not establish that Replit's published static hosting was uncompressed.

**How to apply:** When switching instruments, collect a fresh pre-change baseline and disclose the switch. Confirm actual response headers before claiming compression or caching, and do not describe local results as production results.

**How to apply:** Use read-only queries and actual API responses for routine checks. Defer schema/index changes until representative workload evidence shows a benefit, and do not infer production capacity from a small development database.

Use a locally bundled build for comparable browser LCP measurements, with identical routes, cold browser contexts, fixed viewport/network/CPU settings, and repeated runs. Clearly distinguish local measurements from published-site measurements.

**Why:** Vite's development module requests inflate throttled mobile timings. Image-byte reductions also do not prove an LCP improvement when the existing listing has no actual photo or when text is the LCP element.

**How to apply:** Report the measured result honestly, including inconclusive or slower results; keep sample-image compression separate from page-level performance claims.

Marketplace performance fixes must preserve the finished design and business logic, and must not reprocess old listing photos.

**Why:** The user explicitly repeated “دون تغيير التصميم أو المنطق” when requesting listing-detail CLS fixes, after imposing the same scope on startup optimization.

**How to apply:** Align loading placeholders with the existing responsive content geometry; do not redesign cards, reorder seller actions, hide real content, or alter publishing/contact rules to improve a metric.

Animation additions must use CSS, preserve the JavaScript byte budget, exempt initial-viewport content, use only transform/opacity, last 150–300ms once, and fully respect reduced motion.

**Why:** These are explicit user constraints, not permission to use the project's existing dependencies for new JavaScript-driven animation.

**How to apply:** Small observer/event triggers may select CSS classes for the requested interactions. Defer scroll reveals until scrolling; do not insert first-screen entry effects or modify business behavior to meet a performance target.

Track emitted JavaScript and compressed page transfers separately. Less source/minified code does not necessarily mean a smaller Brotli response.

**Why:** Replacing repeated utility strings with short CSS class names can reduce raw output while increasing compressed bytes through different compression patterns.

**How to apply:** Verify both budgets against the original baseline, and clamp negative synthetic/blob transfer sizes in Lighthouse data to zero rather than subtracting them from downloads.

Do not attribute a startup regression to motion from unmatched before/after builds and three-run medians alone.

**Why:** The user required causal isolation after variable Lighthouse results; an on/off comparison within one fixed build did not establish a motion regression.

**How to apply:** Use a temporary runtime switch, alternating paired cold-browser conditions on an immutable build, at least nine samples per condition, and report median/min/max and uncertainty. Warm server compression equally. Keep DOM instrumentation separate from timed Lighthouse runs and remove the application switch afterward.