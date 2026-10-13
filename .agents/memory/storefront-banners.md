---
name: Storefront image banners
description: Product rules for displaying and managing homepage storefront images using existing banner records.
---

Use the existing admin-managed banner records for the public homepage. Show only the uploaded image; do not add copied external imagery, overlaid text, or buttons. Keep legacy title, subtitle, and CTA fields stored and preserved on edits, but do not render them over the image. Make carousel position obvious with a current/total counter, a capsule for the active image, and a distinct dot for each other image; keep the indicator order aligned with the locale direction.

Keep the section directly below the homepage search and above featured listings and categories. Put its localized heading in normal page flow above the image. Use the full container width with a 3:2 frame on phones and a 21:9 frame (max-height 460px) on desktop. Fill the frame with `object-fit: cover` and align to the top so embedded shop names and phone numbers remain visible; do not add a blurred backdrop or contained duplicate. Provide automatic rotation, locale-direction-aware dots, and touch swiping; hide the section when there are no active images. Touch movement follows the finger and settles with velocity-based snapping; reduced-motion preferences make release and automatic changes immediate.

**Why:** The product owner prefers a filled banner frame over letterboxing, but shop names and phone numbers embedded in uploaded artwork must stay visible.

**Why:** The owner requested a clear image-count indicator matching an active capsule and separate inactive dots; a lone tiny mark was not clear enough.

**How to apply:** Treat this as a presentation-only area: preserve admin-managed image sources and optional whole-image destinations, keep all wording outside the image, and retain the localized heading. Keep the responsive ratios and top-aligned cover crop, preload only nearby slides, pause autoplay during interaction, and preserve locale-aware swipe direction and native vertical scrolling. Preserve legacy banner text fields in storage and on edits; visual changes do not require deleting that data.
