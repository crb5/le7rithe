---
name: Administrator password boundary
description: The marketplace admin password is a second backend-controlled session boundary layered on top of Clerk.
---

Administrative access requires both a verified Clerk identity whose verified primary email is server-allowlisted and a separate short-lived administrator session. The separate password is stored only as a scrypt hash; its session token is stored only as a hash, and changing the password revokes other administrator sessions.

**Why:** Clerk proves identity, while the additional password limits access to high-impact marketplace operations and supports independent revocation without replacing existing user accounts.

**How to apply:** Keep password login, logout, change, session expiry, and failed-attempt controls in the API. Treat frontend guards as navigation help only, and never log or return password material or raw session tokens.