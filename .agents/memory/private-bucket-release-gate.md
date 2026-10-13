---
name: Private bucket release gate
description: The release-only receipt check must use the provisioned private App Storage path rather than a local fallback or public object URL.
---

The live payment-review release check is selected by the internal `PRIVATE_OBJECT_DIR` environment path and must force private proof storage. It should never require, print, or persist a public bucket URL.

**Why:** The browser flow is the integration check for signed upload URLs, private ACL metadata, streamed image bytes, and protected response headers; a local in-memory fallback cannot validate those boundaries.

**How to apply:** Provision or select the private App Storage bucket in the release environment, pass its private object path to the API, and run only the authenticated payment-review project with private storage explicitly enabled.

If App Storage provisioning is unavailable because the workspace has exhausted cloud credits, keep the release gate blocked and report the unavailable live check; do not substitute local storage or a simulated bucket for release evidence.

**Why:** A simulated bucket can make the browser command appear green while skipping the private-bucket boundaries this gate exists to protect.

**How to apply:** Separate deterministic runner/redaction probes from the live release verification, and rerun the latter only after private App Storage is available.

Development `/api/readyz` intentionally bypasses the production storage-variable check, so a development `{"status":"ready"}` response is not evidence that App Storage is configured.

**Why:** The readiness helper returns true outside `NODE_ENV=production`; only a production-mode check validates `PRIVATE_OBJECT_DIR` and `DEFAULT_OBJECT_STORAGE_BUCKET_ID`.

**How to apply:** Use production-mode readiness plus a live upload/read test for the storage release gate; do not use the local development readiness response as proof.