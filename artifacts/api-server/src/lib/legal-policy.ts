export const LEGAL_POLICY = {
  termsVersion: "1.0",
  privacyVersion: "1.0",
  lastUpdated: {
    ar: "[يُحدد تاريخ النشر]",
    fr: "[date de publication à définir]",
    en: "[publication date to be set]",
  },
} as const;

export function hasCurrentLegalConsent(
  accepted: { termsVersion: string; privacyVersion: string } | undefined,
  current: { termsVersion: string; privacyVersion: string } = LEGAL_POLICY,
): boolean {
  return accepted?.termsVersion === current.termsVersion
    && accepted.privacyVersion === current.privacyVersion;
}
