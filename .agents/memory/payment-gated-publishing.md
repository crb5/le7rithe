---
name: Payment-gated publishing
description: Marketplace publication rules for paid listings.
---

Paid-listing mode preserves the original gate: an agricultural listing cannot become publicly active until an administrator confirms its linked payment and separately approves publication. With paid listings temporarily disabled, new or edited listings go directly to `pending_review`; an administrator may approve them without payment. Public queries still expose only `active` listings. A seller can open their own rejected listing from its moderation notification, but other non-active states remain hidden from listing details.

**Why:** The marketplace needs an operational pause on collecting listing payments without deleting the existing payment system, records, or routes. Keeping both branches behind paired frontend/backend flags allows the previous policy to be restored.

**How to apply:** Enable both `VITE_ENABLE_PAID_LISTINGS` on the frontend and `ENABLE_PAID_LISTINGS` on the API server to restore payment-gated publishing. When disabled, hide user payment entry points, reject payment submissions with 410, and retain admin review of `pending_review` listings; do not delete payment routes, tables, settings, or historical records. Keep detail access for rejected listings owner-scoped so moderation links work without exposing pending or unpaid listings.