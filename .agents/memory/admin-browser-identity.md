---
name: Admin browser identity
description: Clerk identity requirements for reliable administrator browser checks.
---

Administrator browser checks should authenticate a Clerk user covered by the explicit `ADMIN_CLERK_USER_IDS` allowlist. A user's Clerk `public_metadata.role` may not be present in the session claims used by the backend, even when the metadata exists in Clerk; moderator bootstrap must use a server-side Clerk user lookup when claims only report `user`.

**Why:** The allowlist is the reliable authorization boundary for administrator accounts, while Clerk session claims can omit public metadata for explicitly configured moderators. Relying only on claims can make a valid moderation session appear to be an ordinary user.

**How to apply:** When provisioning or testing the admin portal, select an allowlisted Clerk identity first and verify its local role through the admin session endpoint. A valid Clerk session can still fail protected requests when local administrator bootstrap has drifted; for additive moderator access, resolve the Clerk user record only when claims lack an administrative role, then persist the local actor before protected requests.