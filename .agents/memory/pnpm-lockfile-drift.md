---
name: pnpm lockfile drift
description: Avoid unrelated package-version changes while removing a workspace dependency.
---

When removing a dependency with pnpm, compare the complete lockfile diff against the pre-change baseline. `pnpm remove` can also refresh unrelated transitive packages; restore those unrelated entries so the net lockfile change reflects only the requested dependency and its now-unused transitive packages.

**Why:** Removing the unused API proxy package also changed an unrelated Lighthouse transitive package version. The project owner required a narrow, reviewable dependency diff.

**How to apply:** Before accepting dependency-removal changes, inspect importer, package, and snapshot sections in the lockfile; verify unrelated versions are unchanged, then run `pnpm install --frozen-lockfile`.
