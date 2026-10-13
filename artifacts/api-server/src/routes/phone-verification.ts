import { clerkClient, getAuth } from "@clerk/express";
import {
  SendPhoneVerificationResponse,
  VerifyPhoneNumberResponse,
  SendPhoneVerificationBody,
  VerifyPhoneNumberBody,
} from "@workspace/api-zod";
import {
  db,
  phoneVerificationSessionsTable,
  usersTable,
} from "@workspace/db";
import { and, asc, eq, gt, inArray, lt } from "drizzle-orm";
import { Router, type IRouter, type Request, type Response } from "express";
import { createRequestRateLimiter } from "../lib/request-rate-limit";
import { normalizeMauritaniaPhone } from "../lib/mauritania-phone";
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

const userKey = (req: Request) =>
  getAuth(req).userId ?? `anonymous:${req.ip || "unknown"}`;

router.post(
  "/auth/phone/send",
  createRequestRateLimiter({
    limiterKey: "phone-link-send-minute",
    windowMs: 60_000,
    max: 1,
    keyGenerator: userKey,
    errorMessage: "انتظر 60 ثانية قبل طلب رمز جديد.",
    failClosed: true,
  }),
  createRequestRateLimiter({
    limiterKey: "phone-link-send-hour",
    windowMs: 60 * 60_000,
    max: maxSendsPerHour,
    keyGenerator: userKey,
    errorMessage: "تجاوزت الحد المسموح لإرسال رموز التحقق. حاول لاحقًا.",
    failClosed: true,
  }),
  async (req, res): Promise<void> => {
    const { userId } = getAuth(req);
    if (!userId) {
      res.status(401).json({ error: "يجب تسجيل الدخول أولًا." });
      return;
    }

    const parsed = SendPhoneVerificationBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "رقم الهاتف غير صالح. أدخل رقمًا موريتانيًا يبدأ بـ +222 ويتبعه 8 أرقام." });
      return;
    }

    const phone = normalizeMauritaniaPhone(parsed.data.phone);
    if (!phone) {
      res.status(400).json({ error: "رقم الهاتف غير صالح. أدخل رقمًا موريتانيًا يبدأ بـ +222 ويتبعه 8 أرقام." });
      return;
    }

    const [profile] = await db
      .select({ status: usersTable.status })
      .from(usersTable)
      .where(eq(usersTable.clerkUserId, userId))
      .limit(1);
    if (!profile) {
      res.status(409).json({ error: "تعذر العثور على الحساب. أعد تحميل الصفحة ثم حاول مجددًا." });
      return;
    }
    if (profile.status !== "active") {
      res.status(403).json({ error: "هذا الحساب غير نشط." });
      return;
    }

    const now = new Date();
    const hourAgo = new Date(now.getTime() - 60 * 60_000);
    await db.delete(phoneVerificationSessionsTable)
      .where(lt(phoneVerificationSessionsTable.sentAt, hourAgo));

    const recentSends = await db
      .select({ sentAt: phoneVerificationSessionsTable.sentAt })
      .from(phoneVerificationSessionsTable)
      .where(and(
        eq(phoneVerificationSessionsTable.purpose, "link"),
        eq(phoneVerificationSessionsTable.clerkUserId, userId),
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
            eq(phoneVerificationSessionsTable.purpose, "link"),
            eq(phoneVerificationSessionsTable.clerkUserId, userId),
            inArray(phoneVerificationSessionsTable.status, ["pending", "approved"]),
          ));
        await tx.insert(phoneVerificationSessionsTable).values({
          clerkUserId: userId,
          verificationId,
          phone,
          purpose: "link",
          status: "pending",
          failedAttempts: 0,
          sentAt,
          expiresAt: new Date(sentAt.getTime() + verificationTtlMs),
          updatedAt: sentAt,
        });
      });
    } catch (error) {
      req.log.error({ err: error }, "Could not persist a phone verification session");
      res.status(503).json({ error: "تعذر حفظ طلب التحقق. انتظر قليلًا ثم أرسل رمزًا جديدًا." });
      return;
    }

    res.json(SendPhoneVerificationResponse.parse({
      verificationId,
      resendAfterSeconds: resendDelaySeconds,
    }));
  },
);

router.post(
  "/auth/phone/verify",
  createRequestRateLimiter({
    limiterKey: "phone-link-verify",
    windowMs: 60_000,
    max: 10,
    keyGenerator: userKey,
    errorMessage: "تجاوزت عدد محاولات التحقق. اطلب رمزًا جديدًا بعد قليل.",
    failClosed: true,
  }),
  async (req, res): Promise<void> => {
    const { userId } = getAuth(req);
    if (!userId) {
      res.status(401).json({ error: "يجب تسجيل الدخول أولًا." });
      return;
    }

    const parsed = VerifyPhoneNumberBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "رمز التحقق غير صحيح أو منتهي الصلاحية." });
      return;
    }

    const [profile] = await db
      .select({
        phone: usersTable.phone,
        phoneVerifiedAt: usersTable.phoneVerifiedAt,
        status: usersTable.status,
      })
      .from(usersTable)
      .where(eq(usersTable.clerkUserId, userId))
      .limit(1);
    if (!profile) {
      res.status(409).json({ error: "تعذر العثور على الحساب. أعد تحميل الصفحة ثم حاول مجددًا." });
      return;
    }
    if (profile.status !== "active") {
      res.status(403).json({ error: "هذا الحساب غير نشط." });
      return;
    }

    const [challenge] = await db
      .select()
      .from(phoneVerificationSessionsTable)
      .where(and(
        eq(phoneVerificationSessionsTable.purpose, "link"),
        eq(phoneVerificationSessionsTable.clerkUserId, userId),
        eq(phoneVerificationSessionsTable.verificationId, parsed.data.verificationId),
      ))
      .limit(1);

    if (!challenge) {
      res.status(400).json({ error: "رمز التحقق غير صحيح أو منتهي الصلاحية." });
      return;
    }

    if (challenge.status === "linked") {
      if (profile.phone !== challenge.phone || !profile.phoneVerifiedAt || profile.phoneVerifiedAt < challenge.sentAt) {
        res.status(400).json({ error: "رمز التحقق غير صحيح أو منتهي الصلاحية." });
        return;
      }
      res.json(VerifyPhoneNumberResponse.parse({ phone: challenge.phone, phoneVerified: true }));
      return;
    }

    if (challenge.status !== "approved" && challenge.status !== "pending") {
      res.status(400).json({ error: "رمز التحقق غير صحيح أو منتهي الصلاحية." });
      return;
    }

    if (challenge.status === "pending" && challenge.expiresAt.getTime() <= Date.now()) {
      await db.update(phoneVerificationSessionsTable)
        .set({ status: "expired", updatedAt: new Date() })
        .where(eq(phoneVerificationSessionsTable.id, challenge.id));
      res.status(400).json({ error: "رمز التحقق غير صحيح أو منتهي الصلاحية." });
      return;
    }

    if (challenge.status === "pending") {
      if (challenge.failedAttempts >= maxCodeAttempts) {
        await db.update(phoneVerificationSessionsTable)
          .set({ status: "failed", updatedAt: new Date() })
          .where(eq(phoneVerificationSessionsTable.id, challenge.id));
        res.status(429).json({ error: "انتهت محاولات هذا الرمز. اطلب رمزًا جديدًا بعد قليل." });
        return;
      }

      let approved: boolean;
      try {
        approved = await checkMoorsylVerification(
          challenge.verificationId,
          normalizeOtpDigits(parsed.data.code),
        );
      } catch (error) {
        sendMoorsylError(req, res, error, "check");
        return;
      }

      if (!approved) {
        const failedAttempts = challenge.failedAttempts + 1;
        await db.update(phoneVerificationSessionsTable)
          .set({
            failedAttempts,
            status: failedAttempts >= maxCodeAttempts ? "failed" : "pending",
            updatedAt: new Date(),
          })
          .where(and(
            eq(phoneVerificationSessionsTable.id, challenge.id),
            eq(phoneVerificationSessionsTable.status, "pending"),
          ));

        if (failedAttempts >= maxCodeAttempts) {
          res.status(429).json({ error: "انتهت محاولات هذا الرمز. اطلب رمزًا جديدًا بعد قليل." });
          return;
        }
        res.status(400).json({ error: "رمز التحقق غير صحيح أو منتهي الصلاحية." });
        return;
      }

      const [approvedSession] = await db.update(phoneVerificationSessionsTable)
        .set({ status: "approved", updatedAt: new Date() })
        .where(and(
          eq(phoneVerificationSessionsTable.id, challenge.id),
          eq(phoneVerificationSessionsTable.status, "pending"),
        ))
        .returning({ id: phoneVerificationSessionsTable.id });
      if (!approvedSession) {
        res.status(400).json({ error: "رمز التحقق غير صحيح أو منتهي الصلاحية." });
        return;
      }
    }

    try {
      const [linkedMarketplaceProfile] = await db
        .select({ clerkUserId: usersTable.clerkUserId })
        .from(usersTable)
        .where(and(
          eq(usersTable.phone, challenge.phone),
          gt(usersTable.phoneVerifiedAt, new Date(0)),
        ))
        .limit(1);
      if (linkedMarketplaceProfile && linkedMarketplaceProfile.clerkUserId !== userId) {
        res.status(409).json({ error: "رقم الهاتف مرتبط بحساب آخر." });
        return;
      }

      const clerkPhoneUsers = await clerkClient.users.getUserList({
        phoneNumber: [challenge.phone],
        limit: 100,
      });
      const exactClerkOwners = clerkPhoneUsers.data.filter((user) =>
        user.phoneNumbers.some((number) => number.phoneNumber === challenge.phone),
      );
      if (exactClerkOwners.some((user) => user.id !== userId) || exactClerkOwners.length > 1) {
        res.status(409).json({ error: "رقم الهاتف مرتبط بحساب آخر." });
        return;
      }
    } catch {
      req.log.error("Could not check phone ownership before account linking");
      res.status(503).json({ error: "تعذر التحقق من ملكية الرقم. حاول مجددًا بعد قليل." });
      return;
    }

    const linkedAt = new Date();
    let linkedProfile: { phone: string | null } | null;
    try {
      linkedProfile = await db.transaction(async (tx) => {
        const [linkedSession] = await tx.update(phoneVerificationSessionsTable)
          .set({ status: "linked", updatedAt: linkedAt })
          .where(and(
            eq(phoneVerificationSessionsTable.id, challenge.id),
            eq(phoneVerificationSessionsTable.status, "approved"),
          ))
          .returning({ id: phoneVerificationSessionsTable.id });
        if (!linkedSession) return null;

        const [updated] = await tx.update(usersTable)
          .set({ phone: challenge.phone, phoneVerifiedAt: linkedAt })
          .where(and(
            eq(usersTable.clerkUserId, userId),
            eq(usersTable.status, "active"),
          ))
          .returning({ phone: usersTable.phone });
        if (!updated) throw new Error("Active marketplace profile missing during phone linking");
        return updated;
      });
    } catch (error) {
      req.log.error({ err: error }, "Could not link the verified phone to the marketplace profile");
      res.status(503).json({ error: "تعذر حفظ رقم الهاتف بعد التحقق. أعد المحاولة بعد قليل." });
      return;
    }

    if (!linkedProfile?.phone) {
      res.status(403).json({ error: "تعذر ربط رقم الهاتف بهذا الحساب." });
      return;
    }

    res.json(VerifyPhoneNumberResponse.parse({
      phone: linkedProfile.phone,
      phoneVerified: true,
    }));
  },
);

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
    req.log.error({ err: error }, "Unexpected Moorsyl verification error");
    res.status(502).json({ error: "تعذر الاتصال بخدمة التحقق. حاول مجددًا بعد قليل." });
    return;
  }

  if (error.kind === "invalid_phone") {
    res.status(400).json({ error: "رقم الهاتف غير صالح. أدخل رقمًا موريتانيًا صحيحًا." });
    return;
  }
  if (error.kind === "denied") {
    res.status(400).json({ error: "رمز التحقق غير صحيح أو منتهي الصلاحية." });
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
    req.log.error("Moorsyl verification is not configured or rejected its server key");
    res.status(503).json({ error: "خدمة التحقق غير متاحة حاليًا." });
    return;
  }

  req.log.warn("Moorsyl verification provider returned an unexpected response");
  res.status(502).json({ error: "تعذر الاتصال بخدمة التحقق. حاول مجددًا بعد قليل." });
};

export default router;
