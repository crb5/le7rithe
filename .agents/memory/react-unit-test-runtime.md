---
name: React unit-test runtime
description: Node/TSX component tests do not inherit Vite's JSX transform or mounted application providers.
---

Direct component rendering in Node/TSX must explicitly match the web app's JSX runtime and mount the real providers needed by the component.

**Why:** Vite handled automatic JSX while the Node runner's preserved-JSX configuration emitted classic React references. A component rendered without its localization provider also produced untranslated placeholders despite passing a type check.

**How to apply:** Distinguish compilation/runtime setup failures from product defects. Use an explicit automatic JSX test configuration and realistic provider state before asserting rendered localized UI; do not change production provider behavior just to satisfy isolated tests.
