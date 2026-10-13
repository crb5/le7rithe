---
name: Long JSX line editing
description: Editing guidance for marketplace files that contain generated single-line JSX.
---

When a component's return JSX is kept on one very long line, use small, uniquely matched patches for imports and nearby statements instead of attempting to replace the entire rendered line.

**Why:** Whole-line patches are fragile and can fail even when the intended inline expression is present; narrow hunks preserve the generated layout and reduce accidental changes.

**How to apply:** For a required inline JSX expression change, first prefer an existing derived value or hook that already causes the component to rerender. If a direct replacement is unavoidable, isolate and reformat that component before editing rather than expanding a broad patch.