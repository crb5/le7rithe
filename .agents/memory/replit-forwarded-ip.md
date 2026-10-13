---
name: Replit forwarded IP chain
description: Verified X-Forwarded-For behavior for this app's Replit preview route.
---

In the app's Replit preview, requests reached the API with three `X-Forwarded-For` entries. Client-supplied test markers were removed, and the entry count stayed three when the request supplied one or two forged values. `TRUST_PROXY_HOPS` now controls Express's numeric trust depth, defaults to 3, and accepts only integers from 0 through 5. The diagnostic route returned only counts and booleans and was removed after the check.

**Why:** Per-IP rate limits are ineffective or spoofable if the API trusts the wrong proxy depth or accepts a client-controlled forwarded header.

**How to apply:** Keep numeric Express proxy trust aligned with the observed preview chain. Re-check after the first production deployment and if Replit routing or artifact proxy configuration changes; do not replace the numeric setting with `true` without confirming the trust boundary.
