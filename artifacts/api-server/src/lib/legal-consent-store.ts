import { and, eq } from "drizzle-orm";
import { db, legalConsentsTable } from "@workspace/db";
import { createLegalConsentGuard } from "./legal-consent";

const legalConsentGuard = createLegalConsentGuard(async (clerkUserId, versions) => {
  const [accepted] = await db
    .select({
      clerkUserId: legalConsentsTable.clerkUserId,
      termsVersion: legalConsentsTable.termsVersion,
      privacyVersion: legalConsentsTable.privacyVersion,
    })
    .from(legalConsentsTable)
    .where(and(
      eq(legalConsentsTable.clerkUserId, clerkUserId),
      eq(legalConsentsTable.termsVersion, versions.termsVersion),
      eq(legalConsentsTable.privacyVersion, versions.privacyVersion),
    ))
    .limit(1);
  return accepted?.clerkUserId
    ? {
        clerkUserId: accepted.clerkUserId,
        termsVersion: accepted.termsVersion,
        privacyVersion: accepted.privacyVersion,
      }
    : undefined;
});

export const hasCurrentLegalConsentForClerkUser = legalConsentGuard.hasCurrentConsent;
export const requireCurrentLegalConsent = legalConsentGuard.requireCurrentConsent;
