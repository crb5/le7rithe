---
name: Clerk locale gaps
description: Non-obvious missing French strings in Clerk's official localization bundle.
---

Use Clerk's official Arabic, French, and English locale objects, while preserving narrow tested overrides: Arabic email placeholder and French sign-up password placeholder/password-visibility accessibility label.

**Why:** The official Arabic locale leaves the email placeholder undefined, which falls back to English; the French locale also left the sign-up password placeholder undefined and its visibility toggle labelled in English.

**How to apply:** Keep overrides as small extensions of the official locale objects. When changing Clerk localization or upgrading packages, retest the Arabic email placeholder and both concealed and revealed password states in French before removing overrides. Language changes must update localization without keying or remounting ClerkProvider so the active session survives.