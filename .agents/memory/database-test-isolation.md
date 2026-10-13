---
name: Database test isolation
description: The owner's rule for tests that could reach the marketplace development database.
---

Do not let tests connect to the project's `heliumdb` by default. PostgreSQL-backed tests must use an isolated in-memory database or require an explicit opt-in such as `ALLOW_DEV_DB_TESTS=1`; the default test run must skip them with a clear reason.

**Why:** A prior security-audit test wrote synthetic rate-limit rows to development data, and the owner explicitly prohibited tests from touching that database without opt-in.

**How to apply:** Check test helpers and package scripts before running suites. Unset the opt-in for ordinary verification, and never query or clean test residue unless the user explicitly authorizes that exact database action.
