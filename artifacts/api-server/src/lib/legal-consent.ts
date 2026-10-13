import type { Response } from "express";
import { LEGAL_POLICY, hasCurrentLegalConsent } from "./legal-policy";

type LegalConsentVersions = Pick<typeof LEGAL_POLICY, "termsVersion" | "privacyVersion">;
type LegalConsentErrorResponse = {
  status: (code: number) => { json: (body: unknown) => unknown };
};

export type LegalConsentRecord = {
  clerkUserId: string;
  termsVersion: string;
  privacyVersion: string;
};

export type LegalConsentReader = (
  clerkUserId: string,
  versions: LegalConsentVersions,
) => Promise<LegalConsentRecord | undefined>;

export function createLegalConsentGuard(readConsent: LegalConsentReader) {
  const hasCurrentConsent = async (clerkUserId: string | null | undefined): Promise<boolean> => {
    if (!clerkUserId) return false;

    const accepted = await readConsent(clerkUserId, LEGAL_POLICY);
    return accepted?.clerkUserId === clerkUserId && hasCurrentLegalConsent(accepted);
  };

  const requireCurrentConsent = async (
    clerkUserId: string | null | undefined,
    res: LegalConsentErrorResponse,
  ): Promise<boolean> => {
    if (await hasCurrentConsent(clerkUserId)) return true;

    res.status(403).json({
      code: "LEGAL_CONSENT_REQUIRED",
      error: "Current Terms and Privacy consent is required.",
    });
    return false;
  };

  return { hasCurrentConsent, requireCurrentConsent };
}

export function currentLegalConsentRecord(clerkUserId: string, locale: string) {
  return {
    clerkUserId,
    termsVersion: LEGAL_POLICY.termsVersion,
    privacyVersion: LEGAL_POLICY.privacyVersion,
    locale,
  };
}
