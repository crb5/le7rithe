---
name: Admin authorization and retention
description: Security and data-retention rules for marketplace administration.
---

Administrative access must be enforced by the API using a verified Clerk session, an allowlisted verified primary email fetched server-side from Clerk, and an active local `admin` role. Frontend route guards are only a user-experience layer. Neither Clerk IDs, metadata roles nor a stored database role alone grant access. Ordinary listing mutations must resolve the current Clerk-linked marketplace user and enforce seller ownership.

**Why:** Hiding links or guarding React routes does not protect direct API calls. Marketplace records are also referenced by payments, messages, reports, and saved items, so physical deletion can break history and foreign-key relationships.

**How to apply:** Require server authorization for every administrative mutation and ownership checks for seller mutations. Treat destructive admin actions on listings, packages, payment methods, categories, and subcategories as soft deletion or deactivation unless an explicit retention migration approves physical deletion.

An explicitly allowlisted verified email may provision a local administrator even when an administrator from the previous Clerk application exists. Where no local record for the new identity exists, an unambiguous existing administrator with the same email may be reconnected; never reactivate a disabled record or silently merge duplicate local accounts.

**Why:** The owner requested administrator authorization that survives moving to a personal Clerk application. Clerk IDs change between applications, but the verified email can remain stable; first-admin-only bootstrap would block the replacement identity.

**How to apply:** Keep the email allowlist server-owned and fail closed if absent or if Clerk cannot verify the primary email. Preserve local status checks and the separate password boundary. Coordinate duplicate local-account reconciliation with the migration, not an implicit login-time merge.

Verified-email administrator provisioning must apply during local account creation or first authenticated marketplace use, not only when the administration endpoint is visited.

**Why:** The owner explicitly requires a replacement Clerk identity to receive its local administrator role automatically, including when no prior local account exists. Normal account creation must not leave this identity with an ordinary role until it opens the portal.

**How to apply:** Apply the same server-side verified-primary-email rule to local account creation and active-account promotion, including phone sign-in account provisioning. Never reactivate suspended accounts or bypass the separate administrator password session.

After changing Clerk applications, first authenticated marketplace use must reconnect a unique retained administrator before creating a new local account.

**Why:** Reconnecting only inside the admin portal lets ordinary marketplace entry create a second administrator first, leaving the saved password attached to the old local account.

**How to apply:** Authorize with the server-verified allowlisted primary email, share the administrator bootstrap transaction lock across both entry paths, preserve the retained local ID, and fail rather than create a replacement when retained matches are ambiguous or inactive.

Before destructive cleanup that must preserve the owner, identify the local account through the server-verified Clerk identity, not a stored email alone.

**Why:** A legacy local administrator had an outdated email even though Clerk reported the allowlisted primary email as verified. Email-only cleanup selection would have failed to recognize the owner and endangered the saved administrator password.

**How to apply:** Resolve the allowlisted verified Clerk account, map its current identity to the local record, and assert the retained account and password credential exist before deleting any other accounts. Stop if the mapping is ambiguous.

Ordinary-user and moderator checks for any `/api/admin/*` endpoint should assert the same generic 404 response; route-specific administrator checks run only after the active-admin boundary. An authenticated admin without the second password session retains the explicit 401 response.

**Why:** Hiding the portal requires denying both unauthenticated and authenticated non-admin callers without disclosing whether an admin route exists. The admin router is mounted before marketplace-specific administrator routes.

**How to apply:** Test visitors, ordinary users, and moderators against representative UI routes and APIs and verify the shared 404 body; test an admin separately to preserve the second-password boundary.