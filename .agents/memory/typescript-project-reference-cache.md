---
name: TypeScript project-reference cache
description: API typechecks can resolve stale database declarations after schema edits.
---

When database schema exports change, a normal workspace typecheck may continue using stale project-reference declarations. Force-rebuilding the database package and clearing the dependent API build-info file restores the current types.

**Why:** Incremental TypeScript project references can report missing newly added schema fields even after the source and generated library checks pass.

**How to apply:** After schema changes that affect API routes, force-build `lib/db` and clear the API incremental state before treating server typecheck failures as code errors.