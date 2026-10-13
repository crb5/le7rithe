---
name: Account sign-in options
description: Product requirement for which account identity methods are optional.
---

Users can register and sign in with phone OTP, email/password, or Google. Do not require both a phone number and an email address; linking the other contact method is optional and should remain available later in account settings.

**Why:** Users should be able to create an account with the sign-in method they already have, rather than being blocked until they provide a second contact method.

**How to apply:** Keep phone, email, and Google as independent sign-in paths. Do not require the alternate contact method during registration or remove the option to add it later.

Registration must also expose the alternate contact directly in the form: optional phone immediately after email in email signup, and optional email in phone signup. A supplied alternate contact must be OTP-verified before linking.

**Why:** The user explicitly clarified that a separate optional post-signup page alone does not satisfy the requirement; the optional field belongs in the registration form.

**How to apply:** Keep the inline fields even when verification must happen after the primary method creates an authenticated session. Never treat a retained form draft as verification proof.

Phone registration now collects first name, family name, a required password, and explicit terms acceptance before requesting OTP. Email stays optional in this phone form. Legacy phone-name completion is a separate compatibility path.

**Why:** On 2026-10-07 the user explicitly replaced the earlier single-name phone signup requirement with the two-name/password form. New work must follow the newer requirement, not restore the earlier single-name design.

**How to apply:** Require these fields only for new phone registration, preserve existing OTP sign-in and existing account names/roles, and let Clerk own the password. Do not persist passwords in application storage or phone challenges.

The signup entry screen offers phone and direct Google signup, with email signup behind a small secondary link. Google must not require filling the phone/name/password form or opening a contact-completion page.

**Why:** The user requires method selection before showing registration fields and direct account creation/login through Google.

**How to apply:** Keep the existing legal-consent boundary: present a terms/privacy notice for the deliberate Google continuation action and retain consent finalization without adding a new profile form.
