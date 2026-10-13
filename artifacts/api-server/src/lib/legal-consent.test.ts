import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { RecordLegalConsentBody } from "@workspace/api-zod";
import { LEGAL_POLICY } from "./legal-policy";
import {
  createLegalConsentGuard,
  currentLegalConsentRecord,
  type LegalConsentRecord,
} from "./legal-consent";

const currentRecord = (clerkUserId: string): LegalConsentRecord => ({
  clerkUserId,
  termsVersion: LEGAL_POLICY.termsVersion,
  privacyVersion: LEGAL_POLICY.privacyVersion,
});

describe("server-side legal consent guard", () => {
  it("permits only a current record belonging to the authenticated Clerk user", async () => {
    const guard = createLegalConsentGuard(async (clerkUserId) => currentRecord(clerkUserId));
    assert.equal(await guard.hasCurrentConsent("user-a"), true);
    assert.equal(await guard.hasCurrentConsent(null), false);
  });

  it("rejects missing, outdated, and differently owned records", async () => {
    const records = new Map<string, LegalConsentRecord>([
      ["old-terms-user", { clerkUserId: "old-terms-user", termsVersion: "0.9", privacyVersion: LEGAL_POLICY.privacyVersion }],
      ["old-privacy-user", { clerkUserId: "old-privacy-user", termsVersion: LEGAL_POLICY.termsVersion, privacyVersion: "0.9" }],
    ]);
    const guard = createLegalConsentGuard(async (clerkUserId) => records.get(clerkUserId));

    assert.equal(await guard.hasCurrentConsent("missing-user"), false);
    assert.equal(await guard.hasCurrentConsent("old-terms-user"), false);
    assert.equal(await guard.hasCurrentConsent("old-privacy-user"), false);

    const mismatchedOwnerGuard = createLegalConsentGuard(async () => currentRecord("user-b"));
    assert.equal(await mismatchedOwnerGuard.hasCurrentConsent("user-a"), false);
  });

  it("returns a generic 403 without exposing consent-record details", async () => {
    let statusCode: number | undefined;
    let responseBody: unknown;
    const response = {
      status(code: number) {
        statusCode = code;
        return {
          json(body: unknown) {
            responseBody = body;
          },
        };
      },
    };
    const guard = createLegalConsentGuard(async () => undefined);

    assert.equal(await guard.requireCurrentConsent("user-a", response), false);
    assert.equal(statusCode, 403);
    assert.deepEqual(responseBody, {
      code: "LEGAL_CONSENT_REQUIRED",
      error: "Current Terms and Privacy consent is required.",
    });
    assert.equal(JSON.stringify(responseBody).includes("user-a"), false);
  });

  it("requires an explicit affirmative consent statement and a supported locale", () => {
    assert.equal(RecordLegalConsentBody.safeParse({ accepted: true, locale: "ar" }).success, true);
    assert.equal(RecordLegalConsentBody.safeParse({ accepted: false, locale: "ar" }).success, false);
    assert.equal(RecordLegalConsentBody.safeParse({ locale: "ar" }).success, false);

    const spoofed = RecordLegalConsentBody.safeParse({
      accepted: true,
      locale: "ar",
      clerkUserId: "user-b",
      userId: 42,
    });
    if (spoofed.success) {
      assert.equal("clerkUserId" in spoofed.data, false);
      assert.equal("userId" in spoofed.data, false);
    }
  });

  it("derives the stored user and policy versions from server values", () => {
    assert.deepEqual(currentLegalConsentRecord("session-user", "fr"), {
      clerkUserId: "session-user",
      termsVersion: LEGAL_POLICY.termsVersion,
      privacyVersion: LEGAL_POLICY.privacyVersion,
      locale: "fr",
    });
  });
});
