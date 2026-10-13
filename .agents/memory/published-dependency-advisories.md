---
name: Published dependency advisories
description: How to handle dependency advisories when upstream has not published a verified compatible fix.
---

Only update an affected dependency to a version confirmed as published and fixed by an authoritative advisory or upstream release. If no safe release exists, leave the dependency graph intact and report the unresolved finding; do not guess a version or add an override that merely hides the audit result.

**Why:** An unpublished or unverified version can produce a false sense of safety while the lockfile still resolves to the vulnerable package.

**How to apply:** Check the advisory's fixed-version range and the package registry, then confirm the resolved lockfile and rerun the audit. If there is no published fix, record the blocker and wait for upstream or choose a separately verified replacement.
