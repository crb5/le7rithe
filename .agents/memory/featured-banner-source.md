---
name: Homepage banner source
description: Homepage promotional banners are independent content records, separate from listings and featured offers.
---

Homepage banners must use their own content records and private image objects. They must not consume normal listings, featured listings, latest offers, payment state, or listing moderation state.

**Why:** The product requires promotional content to be independently scheduled and managed without changing marketplace listing, payment, or approval behavior.

**How to apply:** Keep public banner reads and admin banner CRUD on their own API and database entity. Use controlled private image serving, and leave the featured-listings marquee and Latest Offers flow unchanged.

Banner content is optional: normalize blank fields to null, allow the admin record to be saved with no content, and return only active records with at least one displayable field. A CTA label without a target URL is not displayable.

**Why:** An enabled but empty banner must not create a blank block on the homepage or an invalid button, and disabling it must remove it without affecting listings.

**How to apply:** Keep the public query's content predicate aligned with the UI's conditional rendering whenever new optional fields are added.