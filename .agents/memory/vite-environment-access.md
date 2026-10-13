---
name: Vite environment access in unit tests
description: A runtime compatibility constraint for shared Vite UI modules imported by direct Node test runners.
---

Shared frontend modules may be imported directly by the Node-based unit test command rather than through Vite. In that context, `import.meta.env` can be undefined even though Vite provides it in the browser build, so environment reads must be optional or moved behind a runtime-safe helper.

**Why:** A top-level `import.meta.env.BASE_URL` read caused the existing component test file to fail before any test executed.

**How to apply:** When adding base-path, deployment, or other Vite environment access to a shared component module, guard the read and keep the module importable outside the Vite runtime.