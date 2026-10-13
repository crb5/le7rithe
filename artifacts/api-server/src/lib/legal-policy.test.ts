import assert from "node:assert/strict";
import test from "node:test";
import { hasCurrentLegalConsent, LEGAL_POLICY } from "./legal-policy";

test("current policy versions are centrally configured with a publication-date placeholder", () => {
  assert.equal(LEGAL_POLICY.termsVersion, "1.0");
  assert.equal(LEGAL_POLICY.privacyVersion, "1.0");
  assert.equal(LEGAL_POLICY.lastUpdated.ar, "[يُحدد تاريخ النشر]");
  assert.equal(LEGAL_POLICY.lastUpdated.fr, "[date de publication à définir]");
  assert.equal(LEGAL_POLICY.lastUpdated.en, "[publication date to be set]");
});

test("only an exact accepted terms and privacy version pair is current", () => {
  assert.equal(hasCurrentLegalConsent(undefined), false);
  assert.equal(hasCurrentLegalConsent({ termsVersion: "1.0", privacyVersion: "1.0" }), true);
  assert.equal(hasCurrentLegalConsent({ termsVersion: "0.9", privacyVersion: "1.0" }), false);
  assert.equal(hasCurrentLegalConsent({ termsVersion: "1.0", privacyVersion: "0.9" }), false);
});
