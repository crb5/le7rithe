import { Router, type IRouter } from "express";
import { getAuth } from "../lib/auth";
import { and, eq } from "drizzle-orm";
import { db, legalConsentsTable } from "@workspace/db";
import {
  GetLegalPolicyResponse,
  GetMyLegalConsentResponse,
  RecordLegalConsentBody,
  RecordLegalConsentResponse,
} from "@workspace/api-zod";
import { LEGAL_POLICY, hasCurrentLegalConsent } from "../lib/legal-policy";
import { currentLegalConsentRecord } from "../lib/legal-consent";
import { invalidRequestBody } from "../lib/validation-error";

const router: IRouter = Router();

router.get("/legal-policy", (_req, res): void => {
  res.json(GetLegalPolicyResponse.parse(LEGAL_POLICY));
});

router.get("/legal-policy/consent", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const [accepted] = await db
    .select({
      termsVersion: legalConsentsTable.termsVersion,
      privacyVersion: legalConsentsTable.privacyVersion,
      acceptedAt: legalConsentsTable.acceptedAt,
    })
    .from(legalConsentsTable)
    .where(and(
      eq(legalConsentsTable.oidcSubject, userId),
      eq(legalConsentsTable.termsVersion, LEGAL_POLICY.termsVersion),
      eq(legalConsentsTable.privacyVersion, LEGAL_POLICY.privacyVersion),
    ))
    .limit(1);

  res.json(GetMyLegalConsentResponse.parse({
    termsVersion: LEGAL_POLICY.termsVersion,
    privacyVersion: LEGAL_POLICY.privacyVersion,
    needsConsent: !hasCurrentLegalConsent(accepted),
    acceptedAt: accepted?.acceptedAt ?? null,
  }));
});

router.post("/legal-policy/consent", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const parsed = RecordLegalConsentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json(invalidRequestBody(parsed.error));
    return;
  }

  const [inserted] = await db
    .insert(legalConsentsTable)
    .values(currentLegalConsentRecord(userId, parsed.data.locale))
    .onConflictDoNothing()
    .returning({
      termsVersion: legalConsentsTable.termsVersion,
      privacyVersion: legalConsentsTable.privacyVersion,
      acceptedAt: legalConsentsTable.acceptedAt,
    });

  const [accepted] = inserted
    ? [inserted]
    : await db
      .select({
        termsVersion: legalConsentsTable.termsVersion,
        privacyVersion: legalConsentsTable.privacyVersion,
        acceptedAt: legalConsentsTable.acceptedAt,
      })
      .from(legalConsentsTable)
      .where(and(
        eq(legalConsentsTable.oidcSubject, userId),
        eq(legalConsentsTable.termsVersion, LEGAL_POLICY.termsVersion),
        eq(legalConsentsTable.privacyVersion, LEGAL_POLICY.privacyVersion),
      ))
      .limit(1);

  if (!accepted) {
    throw new Error("Unable to load the legal consent record after writing it");
  }

  res.json(RecordLegalConsentResponse.parse(accepted));
});

export default router;
