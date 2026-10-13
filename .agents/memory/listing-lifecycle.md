---
name: Marketplace listing lifecycle
description: Listings are permanent until explicit moderation; legacy expiry fields must never affect visibility or status changes.
---

The marketplace must not use calendar-based listing expiry. New and edited listings remain active until an administrator explicitly changes their moderation state or removes them.

**Why:** Published listings must remain permanent, and historical `expired` records must not be reactivated or otherwise edited automatically.

**How to apply:** Keep legacy expiry columns for compatibility, exclude them from visibility rules and UI, and never bulk-change listing status during startup. Report historical expired rows without modifying them.

## Content editing window

Photos and descriptions may be edited during the first ten minutes from the listing's recorded publication time. Price, contact phone, and WhatsApp number are not limited by that content-editing deadline. Other listing specifications remain locked.

**Why:** The user explicitly shortened the former one-hour window to ten minutes, required one shared duration for frontend/backend, and kept price and contact changes outside that deadline.

**How to apply:** Treat the server as the authority for the deadline, including requests started before it ends but completed afterwards. Localized messages must use the shared duration, not separate hardcoded values. Expired content drafts must not block price/contact changes. This editing window must never introduce automatic listing expiry or alter moderation/payment rules.