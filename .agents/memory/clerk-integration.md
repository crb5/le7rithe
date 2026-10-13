---
name: Clerk integration in the workspace
description: Setup and dependency behavior for Replit-managed Clerk in this pnpm workspace.
---

Install Clerk dependencies with workspace filters targeting the API and web packages; a root-level package install is rejected by pnpm's workspace-root guard. Only Replit-managed Clerk requires the managed server proxy and hostname-derived provider wiring. The owner's external Clerk application uses explicit environment keys and its direct Frontend API instead.

**Why:** The workspace is a pnpm monorepo with auto-install peers disabled, so package ownership and the production proxy must be explicit.

**How to apply:** When another web artifact needs Clerk, install its packages in that artifact and check whether the tenant is external or managed before choosing provider wiring. Restart the managed API and web workflows together before validating.

Authenticated browser storage states created by the E2E setup use short-lived Clerk sign-in tickets; refresh them immediately before long-running browser runs if a test unexpectedly lands on sign-in.

**Why:** A valid storage file can still expire between setup and execution, producing misleading UI timeouts instead of an application failure.

**How to apply:** Run the E2E auth setup before authenticated browser validation when the existing storage states are stale or the test redirects to `/sign-in`.

Automated custom signup checks can be blocked by Cloudflare bot protection before any Clerk OAuth initiation request is observable. This is a verification limitation, not proof that real users can or cannot complete Google signup.

**Why:** The browser runner encountered Turnstile errors and stalled Google initiation even with the documented CAPTCHA mount present. Local request mocks confirmed form behavior but could not establish real OAuth or SMS delivery.

**How to apply:** Preserve bot protection, distinguish mocked UI checks from live authentication, and report unverified provider completion explicitly. Do not disable CAPTCHA or claim that a mocked OTP response proves SMS delivery.

Protected marketplace query components must render only after the Clerk token getter is registered with the shared API client.

**Why:** Registering the getter in an effect while rendering query hooks immediately can let the first request run without its bearer token, even though Clerk already reports a signed-in user.

**How to apply:** Keep the auth bridge ahead of protected query consumers and gate their initial render until registration completes; cover both generated API calls and manual upload fetches in browser tests.

The owner has chosen to use their independently managed Clerk application, Le7rithe, rather than continue with Replit-managed provisioning.

**Why:** The owner explicitly requested the transition after preparing the personal application's settings; this is a provider-management decision, not a request to provision another managed tenant.

**How to apply:** Do not automatically recreate Replit-managed Clerk if it becomes unconfigured. Use the secure Secrets flow for the personal application's keys, preserve the verified-email administrator policy, and treat deletion of external Clerk user stores as outside the protection of project checkpoints.

External Clerk keys must not be replaced by keys inferred from the Replit hostname, or routed through the former managed Frontend API proxy.

**Why:** Managed hostname inference can select a different tenant on a preview or custom domain even when the installed keys are correct.

**How to apply:** Pass the owner's explicit publishable keys to both providers, use the corresponding server secret, and validate that the backend's domain list matches the publishable key's Frontend API. Configure any future external production proxy only as a separate, explicit change.

Clerk's React package version does not necessarily identify the UI version currently rendered; the installed appearance type may be unrestricted rather than an element-name registry.

**Why:** The installed React package delegated rendering to a dynamically loaded, differently versioned Clerk client, and its appearance type was `any`. A successful TypeScript check therefore could not validate appearance element names.

**How to apply:** Check the mounted Clerk element classes and runtime version before changing structural selectors. Preserve attribution and development notices, and treat UI version pinning as a separate dependency change requiring its own scope.

For design-only authentication checks, distinguish simulated visual states from genuine authentication results. Do not create accounts or send SMS just to inspect loading, error, or recent-method badge layout.

**Why:** Visual validation should not change account or delivery data. A synthetic last-used badge can establish containment but cannot establish that Clerk itself renders the same history state.

**How to apply:** Use intercepted responses or explicit layout fixtures for presentation checks, report the tested branch and fixture limitations, and reserve real authentication submissions for authentication work.