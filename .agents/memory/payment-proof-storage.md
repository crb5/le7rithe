---
name: Payment proof storage
description: The current manual payment flow's proof-image storage boundary and production migration requirement.
---

Payment proof images use private object storage with a short-lived presigned upload and an access-controlled object path persisted in the payment record. App Storage is the only upload and retrieval backend; if it is unavailable, the API must fail clearly rather than write to local disk or memory.

**Why:** Payment evidence should not cause large PostgreSQL rows, expose a permanent public data URL, or become stranded in process-local storage that cannot be recovered after a restart.

**How to apply:** Keep the upload path private and serve proofs only through authenticated admin routes; never reintroduce local fallbacks, data URLs, or public object URLs into payment records.