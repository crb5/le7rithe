---
name: Database migration safety
description: The project owner's approval and safety requirements for database schema changes.
---

Before any database schema write, present the exact SQL and wait for explicit approval. Create or confirm a pre-change checkpoint first. Make only additive, non-destructive changes: never drop tables or columns or delete data. Restrict approved changes to the development database and do not publish or modify production without separate explicit approval. If implementing a foreign-key behavior requires replacing a constraint, state that clearly in the proposed SQL.

**Why:** The owner requires reviewable database changes and a recovery point, and wants development work isolated from production.

**How to apply:** Confirm the target and checkpoint before writing; show the complete transaction in chat, get approval, then execute only that transaction against development and run a read-only schema check afterward. If a checkpoint cannot be confirmed, pause and explain the limitation rather than proceeding.
