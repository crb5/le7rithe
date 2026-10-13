---
name: Phone sign-in challenge separation
description: Preserve the security boundary between public phone login and authenticated phone linking.
---

Keep phone verification challenges purpose-specific. A public sign-in challenge may be anonymous, but only an approved server-side provider response can lead to a short-lived Clerk sign-in ticket. A phone-link challenge remains bound to the authenticated Clerk user and only updates that user's marketplace phone.

**Why:** Phone login must begin before a Clerk session exists, while existing post-login phone linking must remain account-scoped. Sharing proof state could let public login mutate an account or let a linking challenge create a session.

**How to apply:** Keep sign-in and link queries/status transitions separate, verify with the provider only on the server, and consume a sign-in challenge before returning its ticket.

Public phone registration and sign-in have distinct server-owned purposes. Registration rejects an existing number and offers sign-in only after OTP approval; it must not silently authenticate the existing account.

**Why:** The user requires explicit sign-in guidance for existing numbers, while disclosing existence before phone ownership is proved would increase account enumeration.

**How to apply:** Persist the purpose when sending the challenge and never allow the verification request to switch it. Preserve existing account names and roles.

Moorsyl invalidates a verification immediately after an approved check (official Verify documentation). Keep the approved proof on the server while retrying a recoverable Clerk failure, rather than re-checking the consumed code.

**Why:** A second provider check returns denied even for the correct code, so treating every finalization retry as a fresh OTP check prevents recovery.

**How to apply:** Lease concurrent checks/finalization, bind recovery to an account created by that registration challenge, and never issue another ticket after a challenge has been consumed.

When an active marketplace profile already owns a verified E.164 phone and links to a Clerk user that has lost that phone number, an approved sign-in challenge may restore the number only to that exact linked Clerk user. Do not create a second identity or attach the number to another Clerk match.

**Why:** A verified local phone/profile link plus fresh provider approval identifies the intended account; refusing the stale Clerk field blocks the legitimate owner, while choosing another identity risks account takeover.

**How to apply:** After server-side OTP approval, confirm there is no exact Clerk phone match, fetch the profile-linked user, attach the same normalized number as verified, then re-fetch and confirm it before issuing a sign-in ticket.
