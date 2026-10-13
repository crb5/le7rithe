---
name: API unit-test runtime
description: Test runner compatibility when API tests load workspace-generated TypeScript packages.
---

When the API package bundles tests with workspace packages externalized and then runs them through Node's native test runner, extensionless exports from generated TypeScript package sources may fail module resolution even when the generated `.ts` file exists. For affected tests, run them with the TSX runner in `@workspace/scripts`; do not regenerate contracts or change production exports just to accommodate the test launcher.

**Why:** Node's native ESM loader does not resolve the extensionless generated module in this test mode, while TSX handles the workspace TypeScript source.

**How to apply:** If an API test fails on an unresolved extensionless generated import rather than a type or behavior error, try `pnpm --filter @workspace/scripts exec tsx --test <paths>` before changing application or OpenAPI code. Paths resolve from `scripts/`; use `../` for test files elsewhere in the workspace.
