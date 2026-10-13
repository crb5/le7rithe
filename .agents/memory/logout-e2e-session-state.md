---
name: Logout E2E session state
description: Clerk confirmation tests must account for session invalidation after a real sign-out.
---

Browser tests that confirm Clerk sign-out cannot reuse the same saved storage state for later scenarios, because the confirmed flow invalidates that session.

**Why:** A shared storage state can make later controls appear signed out even when the UI behavior is correct.

**How to apply:** Run non-destructive cancel/close cases before one final confirmed logout per auth state, or provision a fresh state for each destructive scenario.

Fresh Clerk storage can still be unusable for the admin shell when the corresponding local administrator role is missing; validate `/api/admin/me` before relying on it.

**Why:** Clerk authentication and the marketplace’s local authorization are separate gates, so a valid Clerk session does not guarantee access to admin controls.

**How to apply:** Treat an admin E2E skip caused by `/api/admin/me` as an authorization-fixture problem, not as evidence that the sign-out dialog behavior failed.