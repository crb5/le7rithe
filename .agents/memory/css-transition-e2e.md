---
name: Independent CSS transitions in browser tests
description: Synchronize browser assertions with each independently transitioning CSS property.
---

When a component animates opacity and position through separate CSS properties, wait for each property or the final geometry independently; opacity reaching its target does not mean the position transition is complete.

**Why:** CSS transitions for opacity and translate can finish at different moments, so an immediate bounding-box assertion after checking opacity can fail while the element is still moving.

**How to apply:** In browser tests for animated controls, poll the final bounding-box offset as well as visibility/opacity before asserting restored placement or hidden-state styling.
