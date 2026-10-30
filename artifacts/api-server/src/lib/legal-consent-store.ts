import { and, eq } from "drizzle-orm";
import { db, legalConsentsTable } from "@workspace/db";
import { createLegalConsentGuard } from "./legal-consent";

const legalConsentGuard = createLegalConsentGuard(async (oidcSubject, versions) => {
  const [accepted] = await db
    .select({
      oidcSubject: legalConsentsTable.oidcSubject,
      termsVersion: legalConsentsTable.termsVersion,
      privacyVersion: legalConsentsTable.privacyVersion,
    })
    .from(legalConsentsTable)
    .where(and(
      eq(legalConsentsTable.oidcSubject, oidcSubject),
      eq(legalConsentsTable.termsVersion, versions.termsVersion),
      eq(legalConsentsTable.privacyVersion, versions.privacyVersion),
    ))
    .limit(1);
  return accepted?.oidcSubject
    ? {
        oidcSubject: accepted.oidcSubject,
        termsVersion: accepted.termsVersion,
        privacyVersion: accepted.privacyVersion,
      }
    : undefined;
});

export const hasCurrentLegalConsentForOidcSubject = legalConsentGuard.hasCurrentConsent;
export const requireCurrentLegalConsent = legalConsentGuard.requireCurrentConsent;
