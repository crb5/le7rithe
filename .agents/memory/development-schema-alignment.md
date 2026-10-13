---
name: Development schema alignment
description: Local database drift can make notification-backed browser flows fail before their ownership assertions run.
---

Before triaging an end-to-end failure in a notification-backed flow, compare the development database columns with the current Drizzle model. A stale local database can return a generic 500 during otherwise valid report or payment operations.

**Why:** The local notification table lacked a nullable relation column that the current application selected and inserted, so report submission failed before the ownership flow could be tested.

**How to apply:** For development-only verification, inspect `information_schema` and align the schema through the documented database push path before changing application behavior or weakening the test.