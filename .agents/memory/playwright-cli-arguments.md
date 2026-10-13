---
name: Playwright CLI argument forwarding
description: Prevent filtered E2E commands from accidentally running the full configured suite.
---

For this workspace, avoid forwarding filters through `pnpm run test:e2e -- <args>`: the script received a literal `--`, and Playwright ran all configured tests instead of narrowing to the requested file.

**Why:** A mistaken separator launched unrelated browser tests and triggered the suite timeout.

**How to apply:** Invoke `pnpm exec playwright test --config=e2e/playwright.config.ts <spec> --grep=<pattern>` directly, and verify the selection first with `--list`.