---
name: Mockup preview paths
description: Resolve a mockup sandbox component in the app screenshot tool.
---

Use the full `/__mockup/preview/{group}/{Component}` URL for canvas iframe shapes. For `Screenshot` with `artifactDirName: "mockup-sandbox"`, pass only `/{group}/{Component}` as `path`; the screenshot tool adds the mockup preview prefix itself.

**Why:** Passing the complete iframe route as the screenshot path duplicates the prefix and displays “No component found.”

**How to apply:** Keep the iframe URL and screenshot path conventions distinct when checking mockup previews.