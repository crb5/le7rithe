---
name: Payment proof ownership
description: The authorization boundary for seller-uploaded payment evidence.
---

Payment-proof upload paths must be cryptographically bound to the authenticated seller who requested them. Submission and local fallback upload routes must reject a path signed for another seller with a clear 403 response.

**Why:** A shared or guessed object path must never let another seller claim payment evidence or cause the server to relabel the object as theirs.

**How to apply:** Keep the binding stateless and based on the existing server secret so it survives process restarts and works for both local development uploads and private object storage. Preserve legacy paths only for reading and cleanup, not for new payment submissions.