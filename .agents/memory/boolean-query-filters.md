---
name: Boolean query filters
description: URL query booleans must be normalized before Zod coercion.
---

String values from URL query parameters are not safe to pass directly to `z.coerce.boolean()`: JavaScript treats the non-empty string `"false"` as truthy.

**Why:** A featured-listing request using `featured=false` was interpreted as `featured=true`, causing ordinary listings to appear in the wrong section.

**How to apply:** Normalize exact `"true"` and `"false"` query strings at the route boundary before schema parsing, and keep regression coverage for both values.