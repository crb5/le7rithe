---
name: OpenAPI response schema naming
description: Avoid collisions between operation-shaped response schemas and generated Orval exports.
---

For array responses, keep the array inline in the operation response and reference the item schema separately when a named response wrapper collides with generated operation exports.

**Why:** A component named after the list operation's response collided with the generated export; the inline array shape passed codegen and typechecking.

**How to apply:** After any OpenAPI response change, run codegen and typecheck. If Orval reports duplicate response exports, keep the item schema reusable but inline the array wrapper.

For request bodies, use a named entity/input component when an anonymous body creates identical operation-body names in the generated TypeScript and Zod barrels.

**Why:** Runtime schemas and types generated in separate modules cannot be merged through two star exports under the same name; request-body naming behaves differently from response-array wrappers.

**How to apply:** Fix the OpenAPI source with an input-schema reference and regenerate. Do not rename generated exports manually.
