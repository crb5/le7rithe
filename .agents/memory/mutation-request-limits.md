---
name: Mutation request limits
description: Request limiting policy for marketplace and admin mutation traffic.
---

Mutation endpoints should return a clear 429 with Retry-After when a caller exceeds a bounded request window; stricter limits belong on administrator password entry than on ordinary authenticated listing and messaging actions.

**Why:** Authentication and marketplace mutations are sensitive to repeated requests, but overly broad limits can break normal browsing and seller workflows.

**How to apply:** Preserve existing route inputs and responses, key limits by Clerk identity when available and by trusted proxy IP otherwise, and keep any distributed-rate-limit migration explicit if the app scales beyond one process.