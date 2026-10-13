---
name: Admin notification isolation
description: Admin listing notifications are user-scoped records and must remain isolated from ordinary marketplace notifications.
---

Admin listing notifications are addressed to local admin/moderator user records, linked to the listing, and served only through admin-protected endpoints. Ordinary notification endpoints explicitly exclude the admin listing notification type.

**Why:** The existing notification table is shared by marketplace users and administrators, so a role-specific type and server-side filtering prevent accidental disclosure to regular users.

**How to apply:** Keep notification creation tied to the listing transaction, preserve the admin-only route guard, and mark notifications read when an administrator opens or reviews the linked listing.