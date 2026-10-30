import type { Response } from "express";
import { LEGAL_POLICY, hasCurrentLegalConsent } from "./legal-policy";

type LegalConsentVersions = Pick<typeof LEGAL_POLICY, "termsVersion" | "privacyVersion">;
type LegalConsentErrorResponse = {
  status: (code: number) => { json: (body: unknown) => unknown };
};

export type LegalConsentRecord = {
  oidcSubject: string;
  termsVersion: string;
  privacyVersion: string;
};

export type LegalConsentReader = (
  oidcSubject: string,
  versions: LegalConsentVersions,
) => Promise<LegalConsentRecord | undefined>;

export function createLegalConsentGuard(readConsent: LegalConsentReader) {
  const hasCurrentConsent = async (oidcSubject: string | null | undefined): Promise<boolean> => {
    if (!oidcSubject) return false;

    const accepted = await readConsent(oidcSubject, LEGAL_POLICY);
    return accepted?.oidcSubject === oidcSubject && hasCurrentLegalConsent(accepted);
  };

  const requireCurrentConsent = async (
    oidcSubject: string | null | undefined,
    res: LegalConsentErrorResponse,
  ): Promise<boolean> => {
    if (await hasCurrentConsent(oidcSubject)) return true;

    res.status(403).json({
      code: "LEGAL_CONSENT_REQUIRED",
      error: "Current Terms and Privacy consent is required.",
    });
    return false;
  };

  return { hasCurrentConsent, requireCurrentConsent };
}

export function currentLegalConsentRecord(oidcSubject: string, locale: string) {
  return {
    oidcSubject,
    termsVersion: LEGAL_POLICY.termsVersion,
    privacyVersion: LEGAL_POLICY.privacyVersion,
    locale,
  };
}
