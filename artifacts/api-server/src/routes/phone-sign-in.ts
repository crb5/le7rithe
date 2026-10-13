import { clerkClient, getAuth } from "@clerk/express";
import {
  CompletePhoneSignupProfileBody,
  CompletePhoneSignupProfileResponse,
  SendPhoneSignInCodeBody,
  VerifyPhoneSignInCodeBody,
  type PhoneSignInResult,
} from "@workspace/api-zod";
import {
  db,
  phoneVerificationSessionsTable,
  usersTable,
} from "@workspace/db";
import { and, asc, eq, gt, inArray, isNotNull, lt, or, sum } from "drizzle-orm";
import { Router, type IRouter, type Request, type Response } from "express";
import { createRequestRateLimiter } from "../lib/request-rate-limit";
import { normalizeMauritaniaPhone } from "../lib/mauritania-phone";
import { verifiedAdminIdentity } from "../lib/admin-identity";
import {
  PhoneAuthError,
  phoneChallengeAction,
  phoneFailedAttemptsExceeded,
  phoneNameCompletionFlag,
  resolvePhoneAuthUser,
  validatePhoneSignupProfile,
} from "../lib/phone-auth-user";
import {
  checkMoorsylVerification,
  MoorsylVerificationError,
  sendMoorsylVerification,
} from "../lib/moorsyl-verify";

const router: IRouter = Router();
const verificationTtlMs = 10 * 60 * 1000;
const resendDelaySeconds = 60;
const maxSendsPerHour = 5;
const maxCodeAttempts = 5;
const signInTokenLifetimeSeconds = 60;
const claimLeaseMs = 60_000;
const nameCompletionFlag = phoneNameCompletionFlag;
const publicPurposes = ["sign_in", "sign_up"];

const ipKey = (req: Request) => `phone-sign-in:${req.ip || "unknown"}`;
const privateError = "تعذر إكمال تسجيل الدخول برقم الهاتف. حاول مجددًا بعد قليل.";
const invalidCodeError = "رمز التحقق غير صحيح أو منتهي الصلاحية.";

const redactClerkText = (value: string): string => value
  .replace(/\+?222[\s().-]*\d(?:[\s().-]*\d){7}/g, "[redacted phone]")
  .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted email]")
  .replace(/\buser_[A-Za-z0-9_-]+\b/g, "[redacted user id]");

const sanitizeClerkDetails = (value: unknown, key = ""): unknown => {
  if (/phone|email|identifier|user.?id|token|secret|password|authorization/i.test(key)) return "[redacted]";
  if (typeof value === "string") return redactClerkText(value);
  if (Array.isArray(value)) return value.map((entry) => sanitizeClerkDetails(entry));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([entryKey, entryValue]) =>
      [entryKey, sanitizeClerkDetails(entryValue, entryKey)]));
  }
  return value;
};

const logClerkPhoneFailure = (req: Request, stage: string, error: unknown): void => {
  const detail = error && typeof error === "object" ? error as Record<string, unknown> : {};
  req.log.error({
    event: "clerk_phone_sign_in_step_failed",
    stage,
    clerkError: {
      message: sanitizeClerkDetails(
        error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown Clerk error",
      ),
      code: sanitizeClerkDetails(detail.code),
      errors: sanitizeClerkDetails(detail.errors),
      status: sanitizeClerkDetails(detail.status ?? detail.statusCode),
    },
  }, "Clerk phone sign-in step failed");
};

const clerkFrontendDomain = (publishableKey?: string): string | null => {
  const match = publishableKey?.trim().match(/^pk_(?:test|live)_(.+)$/);
  if (!match) return null;
  try {
    return Buffer.from(match[1], "base64").toString("utf8").replace(/\$$/, "").toLowerCase();
  } catch {
    return null;
  }
};

const checkClerkKeyAlignment = async () => {
  const browserDomain = clerkFrontendDomain(process.env.VITE_CLERK_PUBLISHABLE_KEY);
  const apiDomain = clerkFrontendDomain(process.env.CLERK_PUBLISHABLE_KEY);
  try {
    const { data: domains } = await clerkClient.domains.list();
    const backendDomains = domains.map((domain) =>
      domain.frontendApiUrl.replace(/^https?:\/\//, "").replace(/\/.*$/, "").toLowerCase());
    return {
      browserAndApiPublishableKeysMatch: Boolean(browserDomain && browserDomain === apiDomain),
      backendSecretMatchesBrowserKey: Boolean(browserDomain && backendDomains.includes(browserDomain)),
      backendSecretMatchesApiKey: Boolean(apiDomain && backendDomains.includes(apiDomain)),
      backendDomainCheck: "completed",
    };
  } catch (error) {
    return {
      browserAndApiPublishableKeysMatch: Boolean(browserDomain && browserDomain === apiDomain),
      backendSecretMatchesBrowserKey: false,
      backendSecretMatchesApiKey: false,
      backendDomainCheck: "failed",
      backendDomainCheckError: sanitizeClerkDetails(
        error instanceof Error ? error.message : "Unknown error",
      ),
    };
  }
};

const clerkStep = async <T>(
  req: Request,
  stage: string,
  operation: () => Promise<T>,
): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    logClerkPhoneFailure(req, stage, error);
    throw error;
  }
};

router.post(
  ["/auth/phone/sign-in/send", "/auth/send-code"],
  createRequestRateLimiter({
    limiterKey: "phone-sign-in-send-minute",
    windowMs: 60_000,
    max: 1,
    keyGenerator: ipKey,
    errorMessage: "انتظر 60 ثانية قبل طلب رمز جديد.",
    failClosed: true,
  }),
  createRequestRateLimiter({
    limiterKey: "phone-sign-in-send-hour",
    windowMs: 60 * 60_000,
    max: 10,
    keyGenerator: ipKey,
    errorMessage: "تجاوزت عدد طلبات رمز الهاتف. حاول لاحقًا.",
    failClosed: true,
  }),
  async (req, res): Promise<void> => {
    if (getAuth(req).userId) {
      res.status(409).json({ error: "سجّل الخروج أولًا لتسجيل الدخول برقم آخر." });
      return;
    }

    const parsed = SendPhoneSignInCodeBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "رقم الهاتف غير صالح. أدخل رقمًا موريتانيًا يبدأ بـ +222 ويتبعه 8 أرقام." });
      return;
    }
    const phone = normalizeMauritaniaPhone(parsed.data.phone);
    if (!phone) {
      res.status(400).json({ error: "رقم الهاتف غير صالح. أدخل رقمًا موريتانيًا يبدأ بـ +222 ويتبعه 8 أرقام." });
      return;
    }

    const now = new Date();
    const hourAgo = new Date(now.getTime() - 60 * 60_000);
    try {
      await db.delete(phoneVerificationSessionsTable)
        .where(lt(phoneVerificationSessionsTable.sentAt, hourAgo));
      const recentSends = await db
        .select({ sentAt: phoneVerificationSessionsTable.sentAt })
        .from(phoneVerificationSessionsTable)
        .where(and(
          inArray(phoneVerificationSessionsTable.purpose, publicPurposes),
          eq(phoneVerificationSessionsTable.phone, phone),
          gt(phoneVerificationSessionsTable.sentAt, hourAgo),
        ))
        .orderBy(asc(phoneVerificationSessionsTable.sentAt))
        .limit(maxSendsPerHour);

      if (recentSends.length >= maxSendsPerHour) {
        const retryAfterSeconds = Math.max(
          1,
          Math.ceil((recentSends[0].sentAt.getTime() + 60 * 60_000 - now.getTime()) / 1000),
        );
        res.setHeader("Retry-After", String(retryAfterSeconds));
        res.status(429).json({
          error: "تجاوزت الحد المسموح لإرسال رموز التحقق. حاول لاحقًا.",
          retryAfterSeconds,
        });
        return;
      }
    } catch {
      req.log.error("Could not check phone sign-in SMS limits");
      res.status(503).json({ error: privateError });
      return;
    }

    let verificationId: string;
    try {
      verificationId = await sendMoorsylVerification(phone);
    } catch (error) {
      sendMoorsylError(req, res, error, "send");
      return;
    }

    const sentAt = new Date();
    try {
      await db.transaction(async (tx) => {
        await tx.update(phoneVerificationSessionsTable)
          .set({ status: "superseded", updatedAt: sentAt })
          .where(and(
            inArray(phoneVerificationSessionsTable.purpose, publicPurposes),
            eq(phoneVerificationSessionsTable.phone, phone),
            inArray(phoneVerificationSessionsTable.status, ["pending", "checking", "approved", "finalizing"]),
          ));
        await tx.insert(phoneVerificationSessionsTable).values({
          clerkUserId: null,
          verificationId,
          phone,
          purpose: parsed.data.mode === "sign-up" ? "sign_up" : "sign_in",
          status: "pending",
          failedAttempts: 0,
          sentAt,
          expiresAt: new Date(sentAt.getTime() + verificationTtlMs),
          updatedAt: sentAt,
        });
      });
    } catch {
      req.log.error("Could not persist a phone sign-in challenge");
      res.status(503).json({ error: "تعذر حفظ طلب التحقق. انتظر قليلًا ثم أرسل رمزًا جديدًا." });
      return;
    }

    res.json({
      verificationId,
      resendAfterSeconds: resendDelaySeconds,
    });
  },
);

router.post(
  ["/auth/phone/sign-in/verify", "/auth/verify-code"],
  createRequestRateLimiter({
    limiterKey: "phone-sign-in-verify",
    windowMs: 15 * 60_000,
    max: 20,
    keyGenerator: ipKey,
    errorMessage: "تجاوزت عدد محاولات التحقق. حاول مجددًا بعد قليل.",
    failClosed: true,
  }),
  async (req, res): Promise<void> => {
    if (getAuth(req).userId) {
      res.status(409).json({ error: "سجّل الخروج أولًا لتسجيل الدخول برقم آخر." });
      return;
    }

    const parsed = VerifyPhoneSignInCodeBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: invalidCodeError });
      return;
    }

    const [activeChallenge] = await db
      .select()
      .from(phoneVerificationSessionsTable)
      .where(and(
        inArray(phoneVerificationSessionsTable.purpose, publicPurposes),
        eq(phoneVerificationSessionsTable.verificationId, parsed.data.verificationId),
      ))
      .limit(1);
    if (!activeChallenge || (activeChallenge.purpose !== "sign_up" && activeChallenge.clerkUserId !== null)) {
      res.status(400).json({ error: invalidCodeError });
      return;
    }
    const signup = activeChallenge.purpose === "sign_up";
    let signupProfile: ReturnType<typeof validatePhoneSignupProfile> | undefined;
    if (signup) {
      try {
        signupProfile = validatePhoneSignupProfile(parsed.data);
      } catch (error) {
        if (error instanceof PhoneAuthError) {
          res.status(error.status).json({ error: error.publicMessage, code: error.code });
          return;
        }
        throw error;
      }
    }
    const action = phoneChallengeAction(activeChallenge);
    if (activeChallenge.expiresAt.getTime() <= Date.now()) {
      await db.update(phoneVerificationSessionsTable)
        .set({ status: "expired", updatedAt: new Date() })
        .where(and(
          eq(phoneVerificationSessionsTable.id, activeChallenge.id),
          inArray(phoneVerificationSessionsTable.status, ["pending", "checking", "approved", "finalizing"]),
        ));
      res.status(400).json({ error: invalidCodeError });
      return;
    }
    if (action === "invalid") {
      res.status(400).json({ error: invalidCodeError });
      return;
    }

    if (action === "busy") {
      res.setHeader("Retry-After", "2");
      res.status(429).json({
        error: "يجري التحقق من الرمز الآن. انتظر قليلًا ثم حاول مجددًا.",
        retryAfterSeconds: 2,
      });
      return;
    }
    if (action === "exhausted") {
      await db.update(phoneVerificationSessionsTable)
        .set({ status: "failed", updatedAt: new Date() })
        .where(eq(phoneVerificationSessionsTable.id, activeChallenge.id));
      res.status(429).json({ error: "انتهت محاولات هذا الرمز. اطلب رمزًا جديدًا بعد قليل." });
      return;
    }

    if (action === "check") {
      const attemptsSince = new Date(Date.now() - 60 * 60_000);
      let phoneFailedAttempts: number;
      try {
        const [attempts] = await db
          .select({ count: sum(phoneVerificationSessionsTable.failedAttempts) })
          .from(phoneVerificationSessionsTable)
          .where(and(
            eq(phoneVerificationSessionsTable.phone, activeChallenge.phone),
            inArray(phoneVerificationSessionsTable.purpose, publicPurposes),
            gt(phoneVerificationSessionsTable.sentAt, attemptsSince),
          ));
        phoneFailedAttempts = Number(attempts?.count ?? 0);
      } catch {
        req.log.error("Could not check phone verification attempt limits");
        res.status(503).json({ error: privateError });
        return;
      }
      if (phoneFailedAttemptsExceeded(phoneFailedAttempts)) {
        res.setHeader("Retry-After", "3600");
        res.status(429).json({
          error: "تجاوزت عدد محاولات التحقق لهذا الرقم. حاول بعد ساعة.",
          retryAfterSeconds: 3600,
        });
        return;
      }

      const checkAt = new Date();
      const [checkingChallenge] = await db.update(phoneVerificationSessionsTable)
        .set({ status: "checking", updatedAt: checkAt })
        .where(and(
          eq(phoneVerificationSessionsTable.id, activeChallenge.id),
          or(
            eq(phoneVerificationSessionsTable.status, "pending"),
            and(eq(phoneVerificationSessionsTable.status, "checking"),
              lt(phoneVerificationSessionsTable.updatedAt, new Date(checkAt.getTime() - claimLeaseMs))),
          ),
        ))
        .returning({ id: phoneVerificationSessionsTable.id });
      if (!checkingChallenge) {
        res.status(429).json({ error: "يجري التحقق من الرمز الآن. حاول مجددًا بعد قليل." });
        return;
      }
      const checkClaim = and(
        eq(phoneVerificationSessionsTable.id, activeChallenge.id),
        eq(phoneVerificationSessionsTable.status, "checking"),
        eq(phoneVerificationSessionsTable.updatedAt, checkAt),
      );
      let approved: boolean;
      try {
        approved = await checkMoorsylVerification(activeChallenge.verificationId, normalizeOtpDigits(parsed.data.code));
      } catch (error) {
        await db.update(phoneVerificationSessionsTable)
          .set({ status: "pending", updatedAt: new Date() }).where(checkClaim);
        sendMoorsylError(req, res, error, "check");
        return;
      }
      if (!approved) {
        const failedAttempts = activeChallenge.failedAttempts + 1;
        await db.update(phoneVerificationSessionsTable).set({
          failedAttempts,
          status: failedAttempts >= maxCodeAttempts ? "failed" : "pending",
          updatedAt: new Date(),
        }).where(checkClaim);
        res.status(failedAttempts >= maxCodeAttempts ? 429 : 400).json({
          error: failedAttempts >= maxCodeAttempts
            ? "انتهت محاولات هذا الرمز. اطلب رمزًا جديدًا بعد قليل." : invalidCodeError,
        });
        return;
      }
      // Moorsyl invalidates an approved code immediately. Persist that proof
      // once; a later Clerk failure must not re-check the consumed OTP.
      const [approvedChallenge] = await db.update(phoneVerificationSessionsTable)
        .set({ status: "approved", updatedAt: new Date() })
        .where(checkClaim)
        .returning({ id: phoneVerificationSessionsTable.id });
      if (!approvedChallenge) {
        res.status(429).json({ error: "يجري التحقق من الرمز الآن. حاول مجددًا بعد قليل." });
        return;
      }
    }

    const claimAt = new Date();
    const [claimedChallenge] = await db.update(phoneVerificationSessionsTable)
      .set({ status: "finalizing", updatedAt: claimAt })
      .where(and(
        eq(phoneVerificationSessionsTable.id, activeChallenge.id),
        or(
          eq(phoneVerificationSessionsTable.status, "approved"),
          and(
            eq(phoneVerificationSessionsTable.status, "finalizing"),
            lt(phoneVerificationSessionsTable.updatedAt, new Date(claimAt.getTime() - claimLeaseMs)),
          ),
        ),
      ))
      .returning({ id: phoneVerificationSessionsTable.id });
    if (!claimedChallenge) {
      res.status(429).json({ error: "يجري التحقق من الرمز الآن. حاول مجددًا بعد قليل." });
      return;
    }

    try {
      if (!/^\+222\d{8}$/.test(activeChallenge.phone)) {
        throw new Error("Stored phone challenge is not in +222 E.164 format");
      }
      const user = await resolvePhoneAuthUser(activeChallenge.phone, {
        signup, ...signupProfile, recoveryUserId: activeChallenge.clerkUserId,
      }, {
        findProfiles: () => db.select({ clerkUserId: usersTable.clerkUserId, status: usersTable.status })
          .from(usersTable).where(and(eq(usersTable.phone, activeChallenge.phone),
            isNotNull(usersTable.phoneVerifiedAt))).limit(2),
        findUsers: () => clerkStep(req, "user_search", () => findExactClerkUsers(activeChallenge.phone)),
        getUser: (id) => clerkStep(req, "user_lookup_by_id", () => clerkClient.users.getUser(id)),
        attachVerifiedPhone: async (id, phone) => {
          await clerkStep(req, "attach_verified_phone", () => clerkClient.phoneNumbers.createPhoneNumber({
            userId: id,
            phoneNumber: phone,
            verified: true,
          }));
          return clerkStep(req, "user_lookup_after_phone_attach", () => clerkClient.users.getUser(id));
        },
        createUser: (input) => clerkStep(req, "user_create", () => clerkClient.users.createUser(input)),
        onCreated: async (created) => {
          if (!signup) return;
          const [bound] = await db.update(phoneVerificationSessionsTable)
            .set({ clerkUserId: created.id })
            .where(and(eq(phoneVerificationSessionsTable.id, activeChallenge.id),
              eq(phoneVerificationSessionsTable.status, "finalizing")))
            .returning({ id: phoneVerificationSessionsTable.id });
          if (!bound) throw new Error("Registration challenge claim was lost");
        },
      });
      const currentMetadata = user.publicMetadata as Record<string, unknown>;
      const requiresName = currentMetadata[nameCompletionFlag] === true;
      await ensureMarketplaceProfile(user, activeChallenge.phone);
      const signInToken = await clerkStep(req, "sign_in_token_create", () => clerkClient.signInTokens.createSignInToken({
        userId: user.id,
        expiresInSeconds: signInTokenLifetimeSeconds,
      }));
      const [consumedChallenge] = await db.update(phoneVerificationSessionsTable)
        .set({ status: "signed_in", updatedAt: new Date() })
        .where(and(
          eq(phoneVerificationSessionsTable.id, activeChallenge.id),
          eq(phoneVerificationSessionsTable.status, "finalizing"),
        ))
        .returning({ id: phoneVerificationSessionsTable.id });
      if (!consumedChallenge) throw new Error("Phone sign-in challenge claim was lost");

      const result: PhoneSignInResult = {
        ticket: signInToken.token,
        requiresName,
      };
      res.json(result);
    } catch (error) {
      if (error instanceof PhoneAuthError) {
        await db.update(phoneVerificationSessionsTable)
          .set({ status: "rejected", updatedAt: new Date() })
          .where(and(
            eq(phoneVerificationSessionsTable.id, activeChallenge.id),
            eq(phoneVerificationSessionsTable.status, "finalizing"),
          ));
        res.status(error.status).json({ error: error.publicMessage, ...(error.code ? { code: error.code } : {}) });
        return;
      }
      await db.update(phoneVerificationSessionsTable)
        .set({ status: "approved", updatedAt: new Date() })
        .where(and(
          eq(phoneVerificationSessionsTable.id, activeChallenge.id),
          eq(phoneVerificationSessionsTable.status, "finalizing"),
        ));
      const keyAlignment = await checkClerkKeyAlignment();
      req.log.error({
        event: "clerk_phone_sign_in_failed",
        phoneFormatValid: /^\+222\d{8}$/.test(activeChallenge.phone),
        keyAlignment,
        error: sanitizeClerkDetails(error instanceof Error ? error.message : "Unknown error"),
      }, "Could not complete server-side Clerk phone sign-in");
      res.status(503).json({ error: privateError });
    }
  },
);

router.patch(
  "/account/me/phone-signup-profile",
  async (req, res): Promise<void> => {
    const userId = getAuth(req).userId;
    if (!userId) {
      res.status(401).json({ error: "يجب تسجيل الدخول أولًا." });
      return;
    }

    const parsed = CompletePhoneSignupProfileBody.safeParse(req.body);
    const firstName = parsed.success ? parsed.data.firstName.trim() : "";
    const lastName = parsed.success ? parsed.data.lastName?.trim() : undefined;
    if (!parsed.success || !firstName) {
      res.status(400).json({ error: "الاسم مطلوب." });
      return;
    }

    try {
      const clerkUser = await clerkClient.users.getUser(userId);
      const metadata = clerkUser.publicMetadata as Record<string, unknown>;
      if (metadata[nameCompletionFlag] !== true) {
        res.status(403).json({ error: "لا يحتاج هذا الحساب إلى استكمال الاسم." });
        return;
      }

      const [profile] = await db
        .select({ status: usersTable.status })
        .from(usersTable)
        .where(eq(usersTable.clerkUserId, userId))
        .limit(1);
      if (!profile || profile.status !== "active") {
        res.status(403).json({ error: "تعذر استكمال بيانات هذا الحساب." });
        return;
      }

      // Keep onboarding gated until both Clerk and the marketplace profile
      // have the name, so a partial failure can be safely retried.
      const namedUser = await clerkClient.users.updateUser(userId, { firstName, ...(lastName ? { lastName } : {}) });
      const name = [namedUser.firstName, namedUser.lastName].filter(Boolean).join(" ").trim();
      const initials = initialsFor(name);
      await db.update(usersTable)
        .set({ name, initials })
        .where(and(
          eq(usersTable.clerkUserId, userId),
          eq(usersTable.status, "active"),
        ));
      const namedMetadata = namedUser.publicMetadata as Record<string, unknown>;
      await clerkClient.users.updateUser(userId, {
        publicMetadata: {
          ...namedMetadata,
          [nameCompletionFlag]: false,
        },
      });
      res.json(CompletePhoneSignupProfileResponse.parse({ complete: true }));
    } catch {
      req.log.error("Could not save the required name for a phone-created account");
      res.status(503).json({ error: "تعذر حفظ الاسم. حاول مجددًا بعد قليل." });
    }
  },
);

const findExactClerkUsers = async (phone: string) => {
  const result = await clerkClient.users.getUserList({
    phoneNumber: [phone],
    limit: 100,
  });
  return result.data.filter((user) =>
    user.phoneNumbers.some((number) => number.phoneNumber === phone),
  );
};

const ensureMarketplaceProfile = async (
  user: Awaited<ReturnType<typeof clerkClient.users.getUser>>,
  phone: string,
): Promise<void> => {
  const [profileByPhone] = await db
    .select({ clerkUserId: usersTable.clerkUserId, status: usersTable.status })
    .from(usersTable)
    .where(and(
      eq(usersTable.phone, phone),
      isNotNull(usersTable.phoneVerifiedAt),
    ))
    .limit(1);
  if (profileByPhone && profileByPhone.clerkUserId !== user.id) {
    throw new PhoneAuthError(409, "رقم الهاتف مرتبط بحساب آخر. تواصل مع الدعم.");
  }

  const [profile] = await db
    .select({ id: usersTable.id, status: usersTable.status, phone: usersTable.phone, phoneVerifiedAt: usersTable.phoneVerifiedAt })
    .from(usersTable)
    .where(eq(usersTable.clerkUserId, user.id))
    .limit(1);
  if (profile?.status && profile.status !== "active") {
    throw new PhoneAuthError(403, "هذا الحساب غير نشط. تواصل مع الدعم.");
  }

  const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || "مستخدم";
  const email = user.primaryEmailAddress?.emailAddress ?? null;
  const administrator = verifiedAdminIdentity(user, user.id, process.env.ADMIN_ALLOWED_EMAILS);
  const now = new Date();
  if (profile) {
    await db.update(usersTable)
      .set({
        phone,
        phoneVerifiedAt: profile.phone === phone && profile.phoneVerifiedAt ? profile.phoneVerifiedAt : now,
        ...(email ? { email } : {}),
        ...(administrator ? { role: "admin", email: administrator.email } : {}),
      })
      .where(eq(usersTable.id, profile.id));
    return;
  }

  const initials = initialsFor(name);
  await db.insert(usersTable)
    .values({
      clerkUserId: user.id,
      name,
      email,
      initials,
      phone,
      phoneVerifiedAt: now,
      role: administrator ? "admin" : "user",
      status: "active",
    })
    .onConflictDoNothing({ target: usersTable.clerkUserId });
  const [createdOrExisting] = await db.select({ id: usersTable.id, status: usersTable.status })
    .from(usersTable)
    .where(eq(usersTable.clerkUserId, user.id))
    .limit(1);
  if (!createdOrExisting) {
    throw new PhoneAuthError(409, "رقم الهاتف مرتبط بحساب آخر. تواصل مع الدعم.");
  }
  if (createdOrExisting.status !== "active") {
    throw new PhoneAuthError(403, "هذا الحساب غير نشط. تواصل مع الدعم.");
  }
};

const initialsFor = (name: string): string =>
  name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] || "").join("") || "م";

const normalizeOtpDigits = (value: string): string => value
  .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
  .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0));

const sendMoorsylError = (
  req: Request,
  res: Response,
  error: unknown,
  operation: "send" | "check",
): void => {
  if (!(error instanceof MoorsylVerificationError)) {
    req.log.error("Unexpected phone verification provider failure");
    res.status(502).json({ error: "تعذر الاتصال بخدمة التحقق. حاول مجددًا بعد قليل." });
    return;
  }
  if (error.kind === "invalid_phone" || error.kind === "denied") {
    res.status(400).json({ error: invalidCodeError });
    return;
  }
  if (error.kind === "rate_limited") {
    res.setHeader("Retry-After", String(resendDelaySeconds));
    res.status(429).json({
      error: operation === "send"
        ? "وصلت إلى الحد المسموح لإرسال رموز التحقق. حاول لاحقًا."
        : "تجاوزت عدد محاولات التحقق. اطلب رمزًا جديدًا بعد قليل.",
      retryAfterSeconds: resendDelaySeconds,
    });
    return;
  }
  if (error.kind === "configuration") {
    req.log.error("Moorsyl phone verification is not configured");
    res.status(503).json({ error: "خدمة التحقق غير متاحة حاليًا." });
    return;
  }
  req.log.warn("Moorsyl phone verification returned an unexpected response");
  res.status(502).json({ error: "تعذر الاتصال بخدمة التحقق. حاول مجددًا بعد قليل." });
};

export default router;
