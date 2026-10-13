---
name: Historical Playwright trace credentials
description: Credential exposure risks in browser traces committed to Git history.
---

Git history contains historical Playwright trace and network artifacts with Clerk session JWTs and opaque development-scoped JWT-like values. The identified sessions were expired at the time of the audit, but the artifacts remain exposed in repository history. Never print or copy token values into reports.

**Why:** Browser network recordings can preserve bearer credentials after the live session expires, and deleting a trace from the working tree does not remove it from Git history.

**How to apply:** Disable network traces for authenticated Playwright runs, keep test output and generated auth states out of Git, and never print token values. If history scans find session material, revoke confirmed active test identities and treat history rewriting as a destructive operation that requires explicit approval.