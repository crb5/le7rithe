---
name: Playwright browser runtime
description: Environment behavior affecting authenticated browser regression execution.
---

The environment can expose a working Chromium binary at `/repl/tools/bin/chromium`, but the installed Playwright test runner may still resolve its own browser-cache path instead of honoring the configured executable override.

**Why:** Browser regression failures can occur before any test code runs, so they should not be mistaken for application or authentication regressions.

**How to apply:** Verify the managed binary with a direct Playwright launch and separately confirm the test runner’s resolved browser before changing application code or adding project-specific browser configuration.

Authenticated storage states are also bound to the exact preview origin that created them. When the preview domain changes, regenerate the storage state before diagnosing a browser regression as an application failure.

**Why:** Clerk session cookies in a saved state are scoped to the previous Replit preview host, so a valid-looking state can still open the public sign-in screen on a new host.

**How to apply:** Compare the storage-state origin with the current E2E base URL before running authenticated browser tests; refresh the state when they differ.

The Playwright test runner may require its own cached FFmpeg build even when a system-level `ffmpeg` package is installed.

**Why:** Video capture setup happens before test code runs, so a missing Playwright-managed binary can look like a browser or application failure.

**How to apply:** If a test fails with a missing `ffmpeg-*/ffmpeg-linux` path, install the matching Playwright FFmpeg component before debugging the test or application.