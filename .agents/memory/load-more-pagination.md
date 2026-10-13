---
name: Load-more pagination state
description: Preserve the load-more control while a request for the next page is pending.
---

Keep the last successfully loaded page separate from the requested page. Compute whether more results exist from the loaded page, not the page currently being requested.

**Why:** Advancing the requested page before the response arrives can make `hasMore` false and unmount the button that should show its disabled/loading state.

**How to apply:** In append-style pagination, retain the previous loaded-page value until the matching page response is accepted; update it alongside appended results.