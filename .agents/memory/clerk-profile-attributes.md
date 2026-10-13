---
name: Clerk profile attributes
description: Clerk instance configuration required for marketplace account name edits.
---

The Clerk instance must have the `first_name` and `last_name` profile attributes enabled before browser-side `user.update({ firstName, lastName })` can save account names. When either attribute is disabled, Clerk rejects the request with a 422 `form_param_unknown` response before any later account step runs.

**Why:** The account page saves the name through Clerk before creating or verifying a phone number, so a disabled profile attribute prevents the complete account-edit flow from reaching phone verification.

**How to apply:** Before validating account edits, inspect the active Clerk instance's user attributes and enable both name fields. Then rerun the authenticated browser flow through name save, phone code entry, success toast, and reload persistence.

Confirm the application and environment actually used by the running client before concluding that dashboard changes apply to it. SDK arguments use camelCase, but Clerk serializes REST request fields to snake_case; an error mentioning `first_name` is not evidence that application code supplied a wrongly named SDK argument.

**Why:** A user reported enabling the name attributes while the instance observed from the running preview still reported them disabled. Assuming the configured dashboard and preview are the same instance leads to ineffective code changes.

**How to apply:** Compare the active client instance's public identity and attribute settings with the intended Clerk application/environment. Preserve the SDK's supported request serialization and do not print or request credential values to make that comparison.