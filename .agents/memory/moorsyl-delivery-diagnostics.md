---
name: Moorsyl delivery diagnostics
description: Distinguish accepted Verify requests from SMS delivery and correlate historical attempts safely.
---

A successful Moorsyl Verify send response proves acceptance, not delivery to the handset. Missing requests in current workflow logs do not prove an earlier attempt never reached Moorsyl.

**Why:** A live SMS investigation found earlier verification records while the restarted workflow's available logs contained no corresponding send requests. Treating that log gap as a transport failure would misidentify the fault.

**How to apply:** Correlate the user's confirmed attempt time and masked phone information with retained evidence. Distinguish an inferred successful response from a captured exact HTTP status; never invent a status or error body that was not retained. For accepted requests without receipt, review Moorsyl delivery records before proposing code changes or another controlled send. Do not automatically resend repeatedly.

The official delivery/webhook documentation reviewed on 2026-10-07 defines SMS `sent` and `sms.sent` as carrier acknowledgment, not handset delivery. A `providerMessageId` is a provider reference, not itself a DLR. The documented SMS states contain no handset `delivered` state, and Verify events do not document a link from `verificationId` to `smsId`.

**Why:** Reporting `sms.sent` as a successful handset DLR would falsely claim the missing OTP reached the recipient.

**How to apply:** Before implementing delivery tracking for Verify OTPs, confirm with Moorsyl whether OTPs emit SMS events, how the two IDs are correlated, and whether actual carrier DLR data is available. Recheck the official [delivery status](https://docs.moorsyl.com/delivery-and-error-codes) and [webhook](https://docs.moorsyl.com/webhooks) references; do not invent undocumented event names or response fields.
