---
name: Public marketplace with protected publishing
description: Access policy for public marketplace browsing, guest save prompts, and authenticated seller actions.
---

Allow visitors to render the marketplace home, categories, listing search, listing details, legal pages, and public listing images without a Clerk session. Require Clerk authentication for publishing, image uploads, payment, account, messaging, support, saved listings, notifications, reports, dashboards, and administration.

**Why:** The product owner wants browsing and discovery to be frictionless, while publishing and user-owned actions must still be attributable to an authenticated seller.

**How to apply:** Keep public read routes outside the global API auth gate, enforce authentication inside private route handlers, and preserve the requested local return path when the publish flow sends a visitor to sign-in or sign-up.

For guests, tapping save on a public listing should first show a sign-in prompt without navigating away. Only an explicit continue action should route to sign-in with the current local path as its return target.

**Why:** The listing remains public, and an immediate auth redirect unexpectedly resets the visitor's reading position.

**How to apply:** Route unauthenticated favorite attempts through the shared prompt shown by the marketplace shell; retain the current route in its explicit sign-in action.