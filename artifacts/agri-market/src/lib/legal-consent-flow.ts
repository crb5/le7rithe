import type { MarketplaceLanguage } from '@/lib/language';

export const PENDING_LEGAL_CONSENT_KEY = 'le7rithe:pending-legal-consent:v1';

export type PendingLegalConsent = {
  locale: MarketplaceLanguage;
  redirectPath: string;
};

export function parsePendingLegalConsent(value: string | null): PendingLegalConsent | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as Partial<PendingLegalConsent>;
    if (
      (parsed.locale !== 'ar' && parsed.locale !== 'fr' && parsed.locale !== 'en')
      || typeof parsed.redirectPath !== 'string'
      || !parsed.redirectPath.startsWith('/')
      || parsed.redirectPath.startsWith('//')
    ) {
      return null;
    }
    return { locale: parsed.locale, redirectPath: parsed.redirectPath };
  } catch {
    return null;
  }
}

export function savePendingLegalConsent(consent: PendingLegalConsent): boolean {
  try {
    window.sessionStorage.setItem(PENDING_LEGAL_CONSENT_KEY, JSON.stringify(consent));
    return true;
  } catch {
    return false;
  }
}

export function readPendingLegalConsent(): PendingLegalConsent | null {
  try {
    return parsePendingLegalConsent(window.sessionStorage.getItem(PENDING_LEGAL_CONSENT_KEY));
  } catch {
    return null;
  }
}

export function clearPendingLegalConsent(): void {
  try {
    window.sessionStorage.removeItem(PENDING_LEGAL_CONSENT_KEY);
  } catch {
    // Consent is still stored on the server; a stale local marker is harmless.
  }
}
