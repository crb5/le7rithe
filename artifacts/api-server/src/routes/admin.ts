import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { getAuth, identityFromClaims } from "../lib/auth";
import { and, asc, count, desc, eq, gt, gte, ilike, inArray, isNotNull, isNull, lt, ne, or, sql } from "drizzle-orm";
import {
  auditLogsTable,
  adminCredentialsTable,
  adminSessionsTable,
  bannersTable,
  categoriesTable,
  db,
  listingsTable,
  notificationsTable,
  paymentMethodsTable,
  paymentPackagesTable,
  paymentsTable,
  reportsTable,
  rentalSeasonSettingsTable,
  supportSettingsTable,
  subcategoriesTable,
  usersTable,
} from "@workspace/db";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import {
  ProcessAdminBannerImageUploadBody,
  ProcessAdminBannerImageUploadResponse,
  RequestBannerImageUploadBody,
  RequestBannerImageUploadResponse,
  z,
} from "@workspace/api-zod";
import { ObjectNotFoundError, ObjectStorageService } from "../lib/objectStorage";
import {
  InvalidListingImageError,
  LISTING_IMAGE_MAX_BYTES,
  LISTING_IMAGE_TYPES,
  processListingImage,
  readListingImageInput,
  withListingImageProcessing,
} from "../lib/listing-image-processing";
import { ENABLE_PAID_LISTINGS } from "../lib/features";
import { loadPaymentProofResponse } from "../lib/paymentProof";
import { invalidSupportPhoneField } from "../lib/mauritania-phone";
import { verifiedAdminIdentity } from "../lib/admin-identity";
import { adminRouteAccessFailure } from "../lib/admin-route-access";
import { imageUrlForClient } from "./marketplace";
import { requireCurrentLegalConsent } from "../lib/legal-consent-store";
import {
  adminPasswordPolicy,
  adminSessionCookieOptions,
  assertStrongAdminPassword,
  checkAdminPasswordRateLimit,
  clearAdminPasswordFailures,
  createAdminSessionToken,
  getAdminPasswordSetupStatus,
  getAdminSessionCookie,
  hashAdminPassword,
  hashAdminSessionToken,
  recordAdminPasswordFailure,
  verifyAdminPassword,
} from "../lib/admin-auth";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

const paymentPackageBody = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).default(""),
  price: z.coerce.number().finite().min(0).max(1_000_000_000),
  currency: z.string().optional(),
  durationDays: z.coerce.number().int().min(1).max(3650),
  listingType: z.string().trim().min(1).max(40),
  features: z.array(z.string().trim().min(1).max(200)).max(30).default([]),
  featured: z.boolean().default(false),
  pinned: z.boolean().default(false),
  active: z.boolean().default(true),
}).strict();

const paymentPackageUpdate = paymentPackageBody.partial();
const userVerificationBody = z.object({
  verified: z.boolean(),
}).strict();
const paymentMethodBody = z.object({
  name: z.string().trim().min(1).max(120),
  accountNumber: z.string().trim().min(1).max(120),
  accountName: z.string().trim().min(1).max(120),
  instructions: z.string().trim().max(2000).default(""),
  currency: z.string().optional(),
  active: z.boolean().default(true),
}).strict();
const paymentMethodUpdate = paymentMethodBody.partial();
const optionalBannerText = (max: number) => z.string().trim().max(max).nullable().optional();
const bannerBody = z.object({
  title: optionalBannerText(160),
  subtitle: optionalBannerText(500),
  additionalText: optionalBannerText(300),
  imagePath: optionalBannerText(300),
  imageAlt: optionalBannerText(200),
  ctaLabel: optionalBannerText(80),
  targetUrl: optionalBannerText(2048),
  active: z.boolean().default(false),
  sortOrder: z.coerce.number().int().min(-100000).max(100000).default(0),
  startsAt: z.string().trim().max(80).nullable().optional(),
  endsAt: z.string().trim().max(80).nullable().optional(),
}).strict();
const bannerUpdate = bannerBody.partial();
const passwordChangeBody = z.object({
  currentPassword: z.string().min(1).max(256),
  newPassword: z.string().min(12).max(128),
  confirmPassword: z.string().min(12).max(128),
}).strict();

type AdminActor = typeof usersTable.$inferSelect | null;
const ADMIN_SESSION_COOKIE = "admin_session";
const bannerObjectPath = /^\/objects\/banners\/[0-9a-f-]{36}$/i;
const bannerImageUploadObjectPath = /^\/objects\/banner-image-inputs\/[0-9a-f-]{36}$/i;

const parseBannerDate = (value: string | null | undefined) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const adminBannerResponse = (banner: typeof bannersTable.$inferSelect) => ({
  id: banner.id,
  title: banner.title,
  subtitle: banner.subtitle,
  additionalText: banner.additionalText,
  imagePath: banner.imagePath,
  imageAlt: banner.imageAlt,
  ctaLabel: banner.ctaLabel,
  targetUrl: banner.targetUrl,
  active: banner.active,
  sortOrder: banner.sortOrder,
  startsAt: banner.startsAt,
  endsAt: banner.endsAt,
  createdAt: banner.createdAt,
  updatedAt: banner.updatedAt,
  imageUrl: banner.imagePath ? `/api/banners/${banner.id}/image` : null,
});

const markBannerImagePrivate = async (imagePath: string | null | undefined) => {
  if (imagePath) {
    await objectStorageService.markObjectPrivate(imagePath, "admin");
  }
};

const withoutListingExpiration = <T extends { expiresAt?: unknown }>(listing: T) => {
  const { expiresAt: _expiresAt, ...withoutExpiration } = listing;
  return withoutExpiration;
};

async function actorForRequest(req: Request): Promise<AdminActor> {
  const auth = getAuth(req);
  const userId = auth.userId;
  if (!userId) return null;
  // Identity comes from the verified OIDC token claims; stored roles are never
  // a fallback. Only a provider-verified, allowlisted email grants access.
  const identity = verifiedAdminIdentity(
    identityFromClaims(userId, auth.claims),
    userId,
    process.env.ADMIN_ALLOWED_EMAILS,
  );
  if (!identity) return null;
  const [existingActor] = await db.select().from(usersTable).where(eq(usersTable.clerkUserId, userId)).limit(1);
  if (existingActor) {
    if (existingActor.status !== "active") return null;
    if (existingActor.role === "admin" && existingActor.email === identity.email) return existingActor;
    const [updatedActor] = await db
      .update(usersTable)
      .set({ role: "admin", email: identity.email })
      .where(eq(usersTable.id, existingActor.id))
      .returning();
    return updatedActor ?? null;
  }

  return db.transaction(async (tx) => {
    // Every bootstrap has explicit verified-email authorization, independent
    // of the old Clerk ID or the presence of an administrator in the old app.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('marketplace_admin_bootstrap'))`);

    const [actor] = await tx.select().from(usersTable).where(eq(usersTable.clerkUserId, userId)).limit(1);
    if (actor) {
      if (actor.status !== "active") return null;
      const [updated] = await tx.update(usersTable)
        .set({ role: "admin", email: identity.email })
        .where(eq(usersTable.id, actor.id)).returning();
      return updated ?? null;
    }

    // A verified allowlisted owner may reconnect their existing local admin
    // after a Clerk-app migration. Preserve its ID, password and related data.
    // Do not merge duplicate users or reactivate a disabled administrator.
    const legacyActors = await tx.select().from(usersTable).where(and(
      eq(usersTable.role, "admin"),
      sql`lower(trim(${usersTable.email})) = ${identity.email}`,
    )).limit(2);
    if (legacyActors.length > 1) return null;
    const legacyActor = legacyActors[0];
    if (legacyActor) {
      if (legacyActor.status !== "active") return null;
      const [reconnected] = await tx.update(usersTable)
        .set({ clerkUserId: userId, email: identity.email })
        .where(eq(usersTable.id, legacyActor.id)).returning();
      return reconnected ?? null;
    }

    const displayName = identity.name;
    const initials = displayName.trim().split(/\s+/).slice(0, 2).map((part) => part[0] || "").join("") || "م";
    const [created] = await tx.insert(usersTable).values({
      clerkUserId: userId,
      name: displayName,
      email: identity.email,
      initials,
      role: "admin",
      status: "active",
    }).onConflictDoNothing({ target: usersTable.clerkUserId }).returning();
    if (created) return created;

    const [existingAfterConflict] = await tx
      .select()
      .from(usersTable)
      .where(eq(usersTable.clerkUserId, userId))
      .limit(1);
    return existingAfterConflict?.status === "active" && existingAfterConflict.role === "admin"
      ? existingAfterConflict : null;
  });
}

function isAdminActor(actor: AdminActor): actor is NonNullable<AdminActor> {
  return Boolean(actor && actor.role === "admin");
}

function sendAdminNotFound(res: Response): void {
  res.status(404).json({ error: "Not found" });
}

async function findAdminCredential(userId: number) {
  const [credential] = await db
    .select()
    .from(adminCredentialsTable)
    .where(eq(adminCredentialsTable.userId, userId))
    .limit(1);
  return credential ?? null;
}

async function ensureAdminCredential(actor: NonNullable<AdminActor>) {
  const existing = await findAdminCredential(actor.id);
  if (existing) return { credential: existing, status: "configured" as const };

  const initialPassword = process.env.ADMIN_INITIAL_PASSWORD;
  const setupStatus = getAdminPasswordSetupStatus(initialPassword);
  if (setupStatus !== "ready") {
    return { credential: null, status: setupStatus };
  }
  if (typeof initialPassword !== "string") {
    return { credential: null, status: "missing-secret" as const };
  }

  const passwordHash = await hashAdminPassword(initialPassword);
  const [created] = await db
    .insert(adminCredentialsTable)
    .values({ userId: actor.id, passwordHash })
    .onConflictDoNothing({ target: adminCredentialsTable.userId })
    .returning();
  return {
    credential: created ?? await findAdminCredential(actor.id),
    status: "configured" as const,
  };
}

async function findAdminSession(req: Request, userId: number) {
  const token = getAdminSessionCookie(req);
  if (!token) return null;

  const [session] = await db
    .select()
    .from(adminSessionsTable)
    .where(and(
      eq(adminSessionsTable.userId, userId),
      eq(adminSessionsTable.tokenHash, hashAdminSessionToken(token)),
      isNull(adminSessionsTable.revokedAt),
      gt(adminSessionsTable.expiresAt, new Date()),
    ))
    .limit(1);
  return session ?? null;
}

async function issueAdminSession(req: Request, res: Response, userId: number) {
  const session = createAdminSessionToken();
  await db.insert(adminSessionsTable).values({
    userId,
    tokenHash: session.tokenHash,
    expiresAt: session.expiresAt,
  });
  res.cookie(ADMIN_SESSION_COOKIE, session.token, adminSessionCookieOptions());
  return session;
}

async function revokeAdminSession(req: Request, userId: number) {
  const token = getAdminSessionCookie(req);
  if (!token) return;
  await db.update(adminSessionsTable)
    .set({ revokedAt: new Date() })
    .where(and(
      eq(adminSessionsTable.userId, userId),
      eq(adminSessionsTable.tokenHash, hashAdminSessionToken(token)),
      isNull(adminSessionsTable.revokedAt),
    ));
}

async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { userId } = getAuth(req);
  const actor = await actorForRequest(req);
  const actorFailure = adminRouteAccessFailure(actor, false);
  if (actorFailure?.status === 404) {
    res.status(actorFailure.status).json({ error: actorFailure.error });
    return;
  }
  const accessFailure = adminRouteAccessFailure(
    actor,
    Boolean(actor && await findAdminSession(req, actor.id)),
  );
  if (accessFailure) {
    res.status(accessFailure.status).json({ error: accessFailure.error });
    return;
  }
  if (!actor) {
    sendAdminNotFound(res);
    return;
  }
  if (!(await requireCurrentLegalConsent(userId, res))) return;
  res.locals.adminActor = actor;
  res.locals.adminRole = actor.role;
  next();
}

function requireAdminOnly(req: Request, res: Response, next: NextFunction): void {
  if (res.locals.adminActor?.role !== "admin") {
    sendAdminNotFound(res);
    return;
  }
  next();
}

async function audit(req: Request, action: string, resourceType: string, resourceId: number | null, details: Record<string, unknown> = {}) {
  const actor = resActor(req);
  const { userId } = getAuth(req);
  await db.insert(auditLogsTable).values({
    actorId: actor?.id ?? null,
    actorClerkUserId: userId ?? null,
    action,
    resourceType,
    resourceId,
    details,
  });
}

function resActor(req: Request): AdminActor {
  return (req.res?.locals.adminActor as AdminActor | undefined) ?? null;
}

function numeric(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

router.get("/admin/me", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  const actor = await actorForRequest(req);
  if (!isAdminActor(actor)) {
    sendAdminNotFound(res);
    return;
  }
  if (!(await requireCurrentLegalConsent(userId, res))) return;
  const credential = await findAdminCredential(actor.id);
  const adminSession = await findAdminSession(req, actor.id);
  const passwordSetupStatus = credential
    ? "configured"
    : getAdminPasswordSetupStatus(process.env.ADMIN_INITIAL_PASSWORD);
  res.json({
    authenticated: Boolean(userId),
    role: actor.role,
    user: actor,
    passwordConfigured: passwordSetupStatus === "configured" || passwordSetupStatus === "ready",
    passwordSetupStatus,
    adminSessionActive: Boolean(adminSession),
    passwordPolicy: adminPasswordPolicy,
  });
});

router.post("/admin/password/login", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  const actor = await actorForRequest(req);
  if (!userId || !isAdminActor(actor)) {
    sendAdminNotFound(res);
    return;
  }
  if (!(await requireCurrentLegalConsent(userId, res))) return;

  const password = req.body?.password;
  const passwordSetup = await ensureAdminCredential(actor);
  if (passwordSetup.status === "missing-secret") {
    res.status(503).json({
      code: "ADMIN_PASSWORD_SETUP_MISSING",
      error: "Administrator password setup is unavailable because ADMIN_INITIAL_PASSWORD is not configured.",
    });
    return;
  }
  if (passwordSetup.status === "invalid-secret") {
    res.status(503).json({
      code: "ADMIN_PASSWORD_SETUP_INVALID",
      error: "Administrator password setup is invalid because ADMIN_INITIAL_PASSWORD does not meet the password policy.",
      passwordPolicy: adminPasswordPolicy,
    });
    return;
  }

  const rateLimit = checkAdminPasswordRateLimit(req, userId);
  if (!rateLimit.allowed) {
    res.setHeader("Retry-After", String(rateLimit.retryAfterSeconds));
    res.status(429).json({ error: "Too many password attempts. Try again later." });
    return;
  }

  const valid = passwordSetup.credential && typeof password === "string"
    ? await verifyAdminPassword(password, passwordSetup.credential.passwordHash)
    : false;
  if (!valid) {
    recordAdminPasswordFailure(req, userId);
    res.status(401).json({
      code: "ADMIN_PASSWORD_INVALID",
      error: "The administrator password is incorrect.",
    });
    return;
  }

  clearAdminPasswordFailures(req, userId);
  await issueAdminSession(req, res, actor.id);
  res.json({ ok: true });
});

router.post("/admin/password/logout", async (req, res): Promise<void> => {
  const actor = await actorForRequest(req);
  if (!isAdminActor(actor)) {
    sendAdminNotFound(res);
    return;
  }
  await revokeAdminSession(req, actor.id);
  res.clearCookie(ADMIN_SESSION_COOKIE, adminSessionCookieOptions());
  res.status(204).end();
});

router.use("/admin", requireAdmin);
router.use("/admin/password/change", requireAdminOnly);
router.use("/admin/users", requireAdminOnly);
router.use("/admin/packages", requireAdminOnly);
router.use("/admin/payment-methods", requireAdminOnly);
router.use("/admin/support-settings", requireAdminOnly);
router.use("/admin/audit-logs", requireAdminOnly);

router.post("/admin/password/change", async (req, res): Promise<void> => {
  const actor = resActor(req);
  if (!isAdminActor(actor)) {
    sendAdminNotFound(res);
    return;
  }

  const parsedPassword = passwordChangeBody.safeParse(req.body);
  if (!parsedPassword.success) {
    res.status(400).json({ error: "Invalid password payload" });
    return;
  }
  const { currentPassword, newPassword, confirmPassword } = parsedPassword.data;
  if (
    typeof currentPassword !== "string"
    || typeof newPassword !== "string"
    || typeof confirmPassword !== "string"
    || newPassword !== confirmPassword
  ) {
    res.status(400).json({ error: "Password confirmation does not match" });
    return;
  }

  try {
    assertStrongAdminPassword(newPassword);
  } catch {
    res.status(400).json({ error: "Password must be 12-128 characters with upper, lower, number, and symbol" });
    return;
  }

  const rateLimit = checkAdminPasswordRateLimit(req, actor.clerkUserId ?? String(actor.id));
  if (!rateLimit.allowed) {
    res.setHeader("Retry-After", String(rateLimit.retryAfterSeconds));
    res.status(429).json({ error: "Too many password attempts. Try again later." });
    return;
  }

  const credential = await findAdminCredential(actor.id);
  const valid = credential ? await verifyAdminPassword(currentPassword, credential.passwordHash) : false;
  if (!valid) {
    recordAdminPasswordFailure(req, actor.clerkUserId ?? String(actor.id));
    res.status(401).json({ error: "Invalid admin credentials" });
    return;
  }

  const passwordHash = await hashAdminPassword(newPassword);
  await db.update(adminCredentialsTable)
    .set({ passwordHash, passwordUpdatedAt: new Date() })
    .where(eq(adminCredentialsTable.userId, actor.id));
  await db.update(adminSessionsTable)
    .set({ revokedAt: new Date() })
    .where(and(eq(adminSessionsTable.userId, actor.id), isNull(adminSessionsTable.revokedAt)));
  await issueAdminSession(req, res, actor.id);
  clearAdminPasswordFailures(req, actor.clerkUserId ?? String(actor.id));
  res.json({ ok: true });
});

router.get("/admin/notifications", async (req, res): Promise<void> => {
  const actor = resActor(req);
  if (!actor) {
    res.json({
      items: [],
      unreadCount: 0,
      unreadCounts: { all: 0, listings: 0, reports: 0 },
      hasMore: false,
      nextCursor: null,
    });
    return;
  }

  const filter = typeof req.query.filter === "string" ? req.query.filter : "all";
  if (filter !== "all" && filter !== "listings" && filter !== "reports") {
    res.status(400).json({ error: "Invalid notification filter" });
    return;
  }

  const beforeCreatedAt = typeof req.query.beforeCreatedAt === "string"
    ? new Date(req.query.beforeCreatedAt)
    : null;
  const beforeId = typeof req.query.beforeId === "string" ? numeric(req.query.beforeId) : null;
  if (
    (beforeCreatedAt && Number.isNaN(beforeCreatedAt.getTime()))
    || (beforeCreatedAt && (!beforeId || beforeId < 1))
    || (beforeId !== null && beforeId < 1)
    || (!beforeCreatedAt && beforeId !== null)
  ) {
    res.status(400).json({ error: "Invalid notification cursor" });
    return;
  }

  const notificationScope = and(
    eq(notificationsTable.userId, actor.id),
    or(
      eq(notificationsTable.type, "admin_new_listing"),
      eq(notificationsTable.type, "admin_new_report"),
    ),
  );
  const notificationWhere = filter === "listings"
    ? and(notificationScope, eq(notificationsTable.type, "admin_new_listing"))
    : filter === "reports"
      ? and(notificationScope, eq(notificationsTable.type, "admin_new_report"))
      : notificationScope;
  const paginatedNotificationWhere = beforeCreatedAt && beforeId
    ? and(
      notificationWhere,
      or(
        lt(notificationsTable.createdAt, beforeCreatedAt),
        and(
          eq(notificationsTable.createdAt, beforeCreatedAt),
          lt(notificationsTable.id, beforeId),
        ),
      ),
    )
    : notificationWhere;
  const pageSize = 50;
  const [rows, unreadRows] = await Promise.all([
    db.select({
      notification: notificationsTable,
      listing: listingsTable,
      report: reportsTable,
      seller: usersTable,
    })
      .from(notificationsTable)
      .leftJoin(listingsTable, eq(notificationsTable.listingId, listingsTable.id))
      .leftJoin(reportsTable, eq(notificationsTable.reportId, reportsTable.id))
      .leftJoin(usersTable, eq(listingsTable.sellerId, usersTable.id))
      .where(paginatedNotificationWhere)
      .orderBy(desc(notificationsTable.createdAt), desc(notificationsTable.id))
      .limit(pageSize + 1),
    db.select({ value: count() })
      .from(notificationsTable)
      .where(and(notificationWhere, eq(notificationsTable.read, false))),
  ]);
  const unreadCountRows = await Promise.all([
    db.select({ value: count() })
      .from(notificationsTable)
      .where(and(notificationScope, eq(notificationsTable.read, false))),
    db.select({ value: count() })
      .from(notificationsTable)
      .where(and(notificationScope, eq(notificationsTable.type, "admin_new_listing"), eq(notificationsTable.read, false))),
    db.select({ value: count() })
      .from(notificationsTable)
      .where(and(notificationScope, eq(notificationsTable.type, "admin_new_report"), eq(notificationsTable.read, false))),
  ]);

  const pageRows = rows.slice(0, pageSize);
  const hasMore = rows.length > pageSize;
  const lastRow = pageRows[pageRows.length - 1];
  const nextCursor = hasMore && lastRow
    ? {
      createdAt: lastRow.notification.createdAt.toISOString(),
      id: lastRow.notification.id,
    }
    : null;
  const listingIds = pageRows
    .map(({ notification }) => notification.listingId)
    .filter((id): id is number => typeof id === "number");
  const payments = listingIds.length
    ? await db.select({
      listingId: paymentsTable.listingId,
      status: paymentsTable.status,
      createdAt: paymentsTable.createdAt,
    })
      .from(paymentsTable)
      .where(inArray(paymentsTable.listingId, listingIds))
      .orderBy(desc(paymentsTable.createdAt))
    : [];
  const latestPaymentByListing = new Map<number, string>();
  for (const payment of payments) {
    if (payment.listingId !== null && !latestPaymentByListing.has(payment.listingId)) {
      latestPaymentByListing.set(payment.listingId, payment.status);
    }
  }

  res.json({
    items: pageRows.map(({ notification, listing, report, seller }) => ({
      ...notification,
      listingTitle: listing?.title ?? null,
      sellerName: seller?.name ?? null,
      sellerVerified: seller?.verified ?? false,
      listingCreatedAt: listing?.createdAt ?? notification.createdAt,
      listingStatus: listing?.status ?? null,
      paymentStatus: listing?.id ? latestPaymentByListing.get(listing.id) ?? "pending" : "pending",
      reportStatus: report?.status ?? null,
    })),
    unreadCount: numeric(unreadRows[0]?.value),
    unreadCounts: {
      all: numeric(unreadCountRows[0][0]?.value),
      listings: numeric(unreadCountRows[1][0]?.value),
      reports: numeric(unreadCountRows[2][0]?.value),
    },
    hasMore,
    nextCursor,
  });
});

router.patch("/admin/notifications/:id/read", async (req, res): Promise<void> => {
    const actor = resActor(req);
  const id = numeric(req.params.id);
  if (!actor || !id) {
    res.status(400).json({ error: "Invalid notification id" });
    return;
  }
  const [notification] = await db.update(notificationsTable)
    .set({ read: true })
    .where(and(
      eq(notificationsTable.id, id),
      eq(notificationsTable.userId, actor.id),
      or(
        eq(notificationsTable.type, "admin_new_listing"),
        eq(notificationsTable.type, "admin_new_report"),
      ),
    ))
    .returning();
  if (!notification) {
    res.status(404).json({ error: "Notification not found" });
    return;
  }
  res.json(notification);
});

router.patch("/admin/notifications/listing/:listingId/read", async (req, res): Promise<void> => {
    const actor = resActor(req);
  const listingId = numeric(req.params.listingId);
  if (!actor || !listingId) {
    res.status(400).json({ error: "Invalid listing id" });
    return;
  }
  await db.update(notificationsTable)
    .set({ read: true })
    .where(and(
      eq(notificationsTable.userId, actor.id),
      eq(notificationsTable.listingId, listingId),
      eq(notificationsTable.type, "admin_new_listing"),
    ));
  res.status(204).send();
});

router.get("/admin/overview", async (req, res): Promise<void> => {
  const actor = resActor(req);
  const [[users], [listings], [pendingReview], [pendingPaymentListings], [activeListings], [payments], [pendingPayments], [revenue], [reports], recentListings, recentOperations] = await Promise.all([
    db.select({ value: count() }).from(usersTable),
    db.select({ value: count() }).from(listingsTable),
    db.select({ value: count() }).from(listingsTable).where(eq(listingsTable.status, "pending_review")),
    db.select({ value: count() }).from(listingsTable).where(eq(listingsTable.status, "pending_payment")),
    db.select({ value: count() }).from(listingsTable).where(and(
      eq(listingsTable.status, "active"),
      isNull(listingsTable.rentalSeasonArchivedAt),
      isNull(listingsTable.rentalAdminHiddenAt),
    )),
    db.select({ value: count() }).from(paymentsTable),
    db.select({ value: count() }).from(paymentsTable).where(eq(paymentsTable.status, "pending")),
    db.select({ value: sql<string>`coalesce(sum(case when ${paymentsTable.status} = 'confirmed' then ${paymentsTable.amount} else 0 end), 0)` }).from(paymentsTable),
    db.select({ value: count() }).from(reportsTable).where(eq(reportsTable.status, "open")),
    db.select({ listing: listingsTable, category: categoriesTable, subcategory: subcategoriesTable, seller: usersTable }).from(listingsTable).innerJoin(categoriesTable, eq(listingsTable.categoryId, categoriesTable.id)).leftJoin(subcategoriesTable, eq(listingsTable.subcategoryId, subcategoriesTable.id)).innerJoin(usersTable, eq(listingsTable.sellerId, usersTable.id)).orderBy(desc(listingsTable.createdAt)).limit(8),
    actor?.role === "admin"
      ? db.select({
        id: auditLogsTable.id,
        action: auditLogsTable.action,
        resourceType: auditLogsTable.resourceType,
        resourceId: auditLogsTable.resourceId,
        createdAt: auditLogsTable.createdAt,
      }).from(auditLogsTable).orderBy(desc(auditLogsTable.createdAt)).limit(8)
      : Promise.resolve([]),
  ]);
  res.json({
    stats: {
      users: numeric(users.value),
      listings: numeric(listings.value),
      pendingReview: numeric(pendingReview.value),
      pendingPaymentListings: numeric(pendingPaymentListings.value),
      activeListings: numeric(activeListings.value),
      payments: numeric(payments.value),
      pendingPayments: numeric(pendingPayments.value),
      revenue: numeric(revenue.value),
      openReports: numeric(reports.value),
    },
    recentListings: recentListings.map(({ listing, category, subcategory, seller }) => ({
      ...withoutListingExpiration(listing),
      imageUrl: imageUrlForClient(listing.imageUrl),
      images: listing.images.map(imageUrlForClient),
      category: category.name,
      categorySlug: category.slug,
      subcategory: subcategory?.name ?? null,
      subcategorySlug: subcategory?.slug ?? null,
      seller: { id: seller.id, name: seller.name, phone: seller.phone, verified: seller.verified },
    })),
    recentOperations,
  });
});

router.get("/admin/analytics", async (_req, res): Promise<void> => {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const listingDay = sql`date_trunc('day', ${listingsTable.createdAt})`;
  const paymentDay = sql`date_trunc('day', ${paymentsTable.createdAt})`;
  const [listingsPerDay, paymentsPerDay, topCategories, statusBreakdown] = await Promise.all([
    db.select({
      day: sql<string>`to_char(${listingDay}, 'YYYY-MM-DD')`,
      count: count(),
    }).from(listingsTable).where(gte(listingsTable.createdAt, since)).groupBy(listingDay).orderBy(listingDay),
    db.select({
      day: sql<string>`to_char(${paymentDay}, 'YYYY-MM-DD')`,
      count: count(),
      revenue: sql<string>`coalesce(sum(case when ${paymentsTable.status} = 'confirmed' then ${paymentsTable.amount} else 0 end), 0)`,
    }).from(paymentsTable).where(gte(paymentsTable.createdAt, since)).groupBy(paymentDay).orderBy(paymentDay),
    db.select({
      name: categoriesTable.name,
      count: count(listingsTable.id),
    }).from(categoriesTable)
      .leftJoin(listingsTable, and(eq(listingsTable.categoryId, categoriesTable.id), eq(listingsTable.status, "active")))
      .where(eq(categoriesTable.active, true))
      .groupBy(categoriesTable.id)
      .orderBy(desc(count(listingsTable.id)))
      .limit(8),
    db.select({ status: listingsTable.status, count: count() }).from(listingsTable).groupBy(listingsTable.status),
  ]);
  res.json({
    listingsPerDay: listingsPerDay.map((r) => ({ day: r.day, count: numeric(r.count) })),
    paymentsPerDay: paymentsPerDay.map((r) => ({ day: r.day, count: numeric(r.count), revenue: numeric(r.revenue) })),
    topCategories: topCategories.map((r) => ({ name: r.name, count: numeric(r.count) })),
    statusBreakdown: statusBreakdown.map((r) => ({ status: r.status, count: numeric(r.count) })),
  });
});

router.get("/admin/rental-season", async (_req, res): Promise<void> => {
  await db.insert(rentalSeasonSettingsTable)
    .values({ id: 1, isOpen: true, renewalFee: "0" })
    .onConflictDoNothing();
  const [seasonRows, activeRentalRows, archivedRentalRows] = await Promise.all([
    db.select().from(rentalSeasonSettingsTable).where(eq(rentalSeasonSettingsTable.id, 1)).limit(1),
    db.select({ total: count() }).from(listingsTable).where(and(
      eq(listingsTable.status, "active"),
      sql`${listingsTable.attributes}->>'saleType' = 'rent'`,
      eq(listingsTable.rentalStatus, "available"),
      isNull(listingsTable.rentalSeasonArchivedAt),
    )),
    db.select({ total: count() }).from(listingsTable).where(and(
      sql`${listingsTable.attributes}->>'saleType' = 'rent'`,
      isNotNull(listingsTable.rentalSeasonArchivedAt),
    )),
  ]);
  const season = seasonRows[0];
  if (!season) {
    res.status(503).json({ error: "Rental season settings are unavailable" });
    return;
  }
  res.json({
    isOpen: season.isOpen,
    seasonName: season.seasonName,
    renewalFee: Number(season.renewalFee),
    changedAt: season.changedAt,
    activeRentals: numeric(activeRentalRows[0]?.total),
    archivedRentals: numeric(archivedRentalRows[0]?.total),
  });
});

router.post("/admin/rental-season/close", async (req, res): Promise<void> => {
  const result = await db.transaction(async (tx) => {
    await tx.insert(rentalSeasonSettingsTable)
      .values({ id: 1, isOpen: true, renewalFee: "0" })
      .onConflictDoNothing();
    const [season] = await tx.select().from(rentalSeasonSettingsTable)
      .where(eq(rentalSeasonSettingsTable.id, 1)).for("update");
    if (!season) throw new Error("Rental season settings are missing");
    const changedAt = new Date();
    await tx.update(rentalSeasonSettingsTable)
      .set({ isOpen: false, changedAt })
      .where(eq(rentalSeasonSettingsTable.id, 1));
    const archived = await tx.update(listingsTable)
      .set({ rentalSeasonArchivedAt: changedAt })
      .where(and(
        eq(listingsTable.status, "active"),
        sql`${listingsTable.attributes}->>'saleType' = 'rent'`,
        isNull(listingsTable.rentalSeasonArchivedAt),
      ))
      .returning({ id: listingsTable.id });
    return { changedAt, archivedCount: archived.length };
  });
  await audit(req, "rental-season.close", "rental-season", 1);
  res.json({ isOpen: false, ...result });
});

router.post("/admin/rental-season/open", async (req, res): Promise<void> => {
  const seasonName = typeof req.body?.seasonName === "string" ? req.body.seasonName.trim().slice(0, 120) : "";
  await db.insert(rentalSeasonSettingsTable)
    .values({ id: 1, isOpen: true, seasonName: seasonName || null, renewalFee: "0" })
    .onConflictDoNothing();
  const changedAt = new Date();
  const [season] = await db.update(rentalSeasonSettingsTable)
    .set({ isOpen: true, seasonName: seasonName || null, changedAt })
    .where(eq(rentalSeasonSettingsTable.id, 1))
    .returning();
  await audit(req, "rental-season.open", "rental-season", 1);
  res.json({ isOpen: season.isOpen, seasonName: season.seasonName, changedAt: season.changedAt });
});

router.patch("/admin/listings/:id/rental-visibility", async (req, res): Promise<void> => {
  const id = numeric(req.params.id);
  if (!id || typeof req.body?.hidden !== "boolean") {
    res.status(400).json({ error: "Invalid rental visibility request" });
    return;
  }
  const [listing] = await db.select().from(listingsTable).where(eq(listingsTable.id, id)).limit(1);
  if (!listing || listing.attributes?.saleType !== "rent") {
    res.status(404).json({ error: "Rental listing not found" });
    return;
  }
  const [updated] = await db.update(listingsTable)
    .set({ rentalAdminHiddenAt: req.body.hidden ? new Date() : null })
    .where(eq(listingsTable.id, id))
    .returning();
  await audit(req, req.body.hidden ? "rental-listing.hide" : "rental-listing.show", "listing", id);
  res.json({ id: updated.id, rentalAdminHiddenAt: updated.rentalAdminHiddenAt });
});

const validBannerTargetUrl = (value: string) => {
  if (value.startsWith("/") && !value.startsWith("//")) return true;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

const parseBannerPayload = (body: unknown, partial = false) => {
  const parsed = (partial ? bannerUpdate : bannerBody).safeParse(body);
  if (!parsed.success) return { error: "Invalid banner payload" as const };
  const value = parsed.data;
  if ((!partial || value.imagePath !== undefined) && !value.imagePath) {
    return { error: "A banner image is required" as const };
  }
  if (value.imagePath && !bannerObjectPath.test(value.imagePath)) {
    return { error: "Banner image must be uploaded through the banner uploader" as const };
  }
  if (value.targetUrl && !validBannerTargetUrl(value.targetUrl)) {
    return { error: "Banner target URL must be a local path or a valid http(s) URL" as const };
  }
  const startsAt = parseBannerDate(value.startsAt);
  const endsAt = parseBannerDate(value.endsAt);
  if ((value.startsAt && startsAt === undefined) || (value.endsAt && endsAt === undefined)) {
    return { error: "Banner dates must be valid" as const };
  }
  if (startsAt && endsAt && startsAt >= endsAt) {
    return { error: "Banner end date must be after its start date" as const };
  }
  const emptyToNull = (item: string | null | undefined) => item === undefined ? undefined : item || null;
  return {
    data: {
      ...value,
      title: emptyToNull(value.title),
      subtitle: emptyToNull(value.subtitle),
      additionalText: emptyToNull(value.additionalText),
      imagePath: emptyToNull(value.imagePath),
      imageAlt: emptyToNull(value.imageAlt),
      ctaLabel: emptyToNull(value.ctaLabel),
      targetUrl: emptyToNull(value.targetUrl),
      startsAt,
      endsAt,
    },
  };
};

router.get("/admin/banners", async (_req, res): Promise<void> => {
  const banners = await db.select().from(bannersTable)
    .orderBy(asc(bannersTable.sortOrder), desc(bannersTable.createdAt));
  res.json({ items: banners.map(adminBannerResponse) });
});

router.post("/admin/banners/uploads/request-url", async (req, res): Promise<void> => {
  const parsed = RequestBannerImageUploadBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid banner image file" });
    return;
  }
  try {
    const uploadURL = await objectStorageService.getObjectEntityUploadURL("banner-image-inputs");
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);
    if (!bannerImageUploadObjectPath.test(objectPath)) {
      res.status(500).json({ error: "Invalid banner image object path" });
      return;
    }
    res.json(RequestBannerImageUploadResponse.parse({ uploadURL, objectPath }));
  } catch (error) {
    req.log.error({ err: error }, "Failed to create banner image upload URL");
    res.status(503).json({ error: "Banner image storage is unavailable" });
  }
});

router.post("/admin/banners/uploads/process", async (req, res): Promise<void> => {
  const parsed = ProcessAdminBannerImageUploadBody.safeParse(req.body);
  if (!parsed.success || !bannerImageUploadObjectPath.test(parsed.data?.objectPath ?? "")) {
    res.status(400).json({ error: "Invalid banner image upload" });
    return;
  }

  const { objectPath } = parsed.data;
  let generatedImagePath: string | null = null;
  try {
    const result = await withListingImageProcessing(async () => {
      const file = await objectStorageService.getObjectEntityFile(objectPath);
      await objectStorageService.markObjectPrivate(objectPath, "admin");
      const [metadata] = await file.getMetadata();
      const contentType = typeof metadata.contentType === "string" ? metadata.contentType : "";
      const actualBytes = Number(metadata.size);
      if (
        !LISTING_IMAGE_TYPES.has(contentType)
        || !Number.isSafeInteger(actualBytes)
        || actualBytes <= 0
        || actualBytes > LISTING_IMAGE_MAX_BYTES
      ) {
        throw new InvalidListingImageError("Unsupported or oversized banner image");
      }

      const input = await readListingImageInput(file.createReadStream());
      const processed = await processListingImage(input, contentType);
      if (processed.full.data.length > LISTING_IMAGE_MAX_BYTES) {
        throw new InvalidListingImageError("Processed banner image exceeds the size limit");
      }

      const imagePath = `/objects/banners/${randomUUID()}`;
      generatedImagePath = imagePath;
      await objectStorageService.createPrivateImage(imagePath, processed.full.data, "admin", {
        purpose: "banner",
      });
      await objectStorageService.deleteObjectIfExists(objectPath);

      return {
        imagePath,
        originalBytes: processed.originalBytes,
        webpBytes: processed.full.data.length,
        width: processed.full.info.width,
        height: processed.full.info.height,
      };
    });
    res.json(ProcessAdminBannerImageUploadResponse.parse(result));
  } catch (error) {
    if (generatedImagePath) {
      try {
        await objectStorageService.deleteObjectIfExists(generatedImagePath);
      } catch (cleanupError) {
        req.log.warn({ err: cleanupError }, "Failed to remove an incomplete banner image");
      }
    }
    try {
      await objectStorageService.deleteObjectIfExists(objectPath);
    } catch (cleanupError) {
      req.log.warn({ err: cleanupError }, "Failed to remove a rejected banner upload");
    }
    if (error instanceof InvalidListingImageError || error instanceof ObjectNotFoundError) {
      res.status(400).json({ error: "Banner image is invalid, unsupported, or too large" });
      return;
    }
    req.log.error({ err: error }, "Failed to process banner image");
    res.status(503).json({ error: "Banner image storage or processing is unavailable" });
  }
});

router.post("/admin/banners", async (req, res): Promise<void> => {
  const parsed = parseBannerPayload(req.body);
  if ("error" in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  try {
    await markBannerImagePrivate(parsed.data.imagePath);
  } catch (error) {
    req.log.error({ err: error }, "Failed to secure banner image");
    res.status(503).json({ error: "Banner image storage is unavailable" });
    return;
  }
  const [banner] = await db.insert(bannersTable).values({
    title: parsed.data.title ?? null,
    subtitle: parsed.data.subtitle ?? null,
    additionalText: parsed.data.additionalText ?? null,
    imagePath: parsed.data.imagePath ?? null,
    imageAlt: parsed.data.imageAlt ?? null,
    ctaLabel: parsed.data.ctaLabel ?? null,
    targetUrl: parsed.data.targetUrl ?? null,
    active: parsed.data.active ?? false,
    sortOrder: parsed.data.sortOrder ?? 0,
    startsAt: parsed.data.startsAt ?? null,
    endsAt: parsed.data.endsAt ?? null,
  }).returning();
  await audit(req, "banner.create", "banner", banner.id);
  res.status(201).json(adminBannerResponse(banner));
});

router.patch("/admin/banners/:id", async (req, res): Promise<void> => {
  const id = numeric(req.params.id);
  const parsed = parseBannerPayload(req.body, true);
  if ("error" in parsed || !id) {
    res.status(400).json({ error: "error" in parsed ? parsed.error : "Invalid banner id" });
    return;
  }
  try {
    await markBannerImagePrivate(parsed.data.imagePath);
  } catch (error) {
    req.log.error({ err: error }, "Failed to secure banner image");
    res.status(503).json({ error: "Banner image storage is unavailable" });
    return;
  }
  const [banner] = await db.update(bannersTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(bannersTable.id, id))
    .returning();
  if (!banner) {
    res.status(404).json({ error: "Banner not found" });
    return;
  }
  await audit(req, "banner.update", "banner", banner.id);
  res.json(adminBannerResponse(banner));
});

router.delete("/admin/banners/:id", async (req, res): Promise<void> => {
  const id = numeric(req.params.id);
  const [banner] = await db.delete(bannersTable).where(eq(bannersTable.id, id)).returning();
  if (!banner) {
    res.status(404).json({ error: "Banner not found" });
    return;
  }
  await audit(req, "banner.delete", "banner", banner.id);
  res.status(204).send();
});

router.get("/admin/listings", async (req, res): Promise<void> => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const status = typeof req.query.status === "string" && req.query.status ? req.query.status : undefined;
  const category = typeof req.query.category === "string" && req.query.category ? req.query.category : undefined;
  const page = Math.max(numeric(req.query.page), 1);
  const limit = Math.min(Math.max(numeric(req.query.limit) || 20, 1), 100);
  const filters = [
    q ? or(ilike(listingsTable.title, `%${q}%`), ilike(usersTable.name, `%${q}%`)) : undefined,
    status ? eq(listingsTable.status, status) : ne(listingsTable.status, "suspended"),
    category ? eq(categoriesTable.slug, category) : undefined,
  ].filter(Boolean);
  const where = filters.length ? and(...filters as [ReturnType<typeof eq>, ...ReturnType<typeof eq>[]]) : undefined;
  const [items, totals] = await Promise.all([
    db.select({ listing: listingsTable, category: categoriesTable, subcategory: subcategoriesTable, seller: usersTable }).from(listingsTable).innerJoin(categoriesTable, eq(listingsTable.categoryId, categoriesTable.id)).leftJoin(subcategoriesTable, eq(listingsTable.subcategoryId, subcategoriesTable.id)).innerJoin(usersTable, eq(listingsTable.sellerId, usersTable.id)).where(where).orderBy(desc(listingsTable.createdAt)).limit(limit).offset((page - 1) * limit),
    db.select({ total: count() }).from(listingsTable).innerJoin(categoriesTable, eq(listingsTable.categoryId, categoriesTable.id)).innerJoin(usersTable, eq(listingsTable.sellerId, usersTable.id)).where(where),
  ]);
  res.json({
    items: items.map(({ listing, category: categoryRow, subcategory, seller }) => ({
      ...withoutListingExpiration(listing),
      imageUrl: imageUrlForClient(listing.imageUrl),
      images: listing.images.map(imageUrlForClient),
      category: categoryRow.name,
      categorySlug: categoryRow.slug,
      subcategory: subcategory?.name ?? null,
      subcategorySlug: subcategory?.slug ?? null,
      seller: { id: seller.id, name: seller.name, phone: seller.phone, verified: seller.verified },
    })),
    total: numeric(totals[0]?.total),
    page,
    limit,
  });
});

router.patch("/admin/listings/:id/status", async (req, res): Promise<void> => {
  const id = numeric(req.params.id);
  const status = typeof req.body?.status === "string" ? req.body.status : "";
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
  const allowed = ["draft", "pending_payment", "pending_review", "active", "rejected", "suspended"];
  if (!id || !allowed.includes(status)) {
    res.status(400).json({ error: "Invalid listing status" });
    return;
  }

  type ModerationResult =
    | { kind: "not_found" }
    | { kind: "conflict" }
    | { kind: "updated"; listing: typeof listingsTable.$inferSelect };

  let result: ModerationResult;
  try {
    result = await db.transaction(async (tx): Promise<ModerationResult> => {
      const [existingListing] = await tx
        .select()
        .from(listingsTable)
        .where(eq(listingsTable.id, id))
        .limit(1);
      if (!existingListing) return { kind: "not_found" };

      let updatedListing: typeof listingsTable.$inferSelect | undefined;
      if (status === "active" && ENABLE_PAID_LISTINGS) {
        const [confirmedPayment] = await tx
          .select({ id: paymentsTable.id, package: paymentPackagesTable })
          .from(paymentsTable)
          .innerJoin(paymentPackagesTable, eq(paymentsTable.packageId, paymentPackagesTable.id))
          .where(and(eq(paymentsTable.listingId, id), eq(paymentsTable.status, "confirmed")))
          .orderBy(desc(paymentsTable.createdAt))
          .limit(1);
        if (!confirmedPayment) throw new Error("LISTING_PAYMENT_NOT_CONFIRMED");
        [updatedListing] = await tx
          .update(listingsTable)
          .set({
            status,
            moderationReason: reason || null,
            moderatedAt: new Date(),
            moderatedBy: resActor(req)?.id ?? null,
            featured: confirmedPayment.package.featured,
            pinned: confirmedPayment.package.pinned,
          })
          .where(and(
            eq(listingsTable.id, id),
            eq(listingsTable.status, existingListing.status),
          ))
          .returning();
      } else {
        [updatedListing] = await tx
          .update(listingsTable)
          .set({
            status,
            moderationReason: reason || null,
            moderatedAt: new Date(),
            moderatedBy: resActor(req)?.id ?? null,
          })
          .where(and(
            eq(listingsTable.id, id),
            eq(listingsTable.status, existingListing.status),
          ))
          .returning();
      }

      if (!updatedListing) return { kind: "conflict" };

      if (existingListing.status !== status) {
        const notification = status === "active"
          ? {
            title: "تم قبول إعلانك بنجاح.",
            body: `اسم الإعلان: «${updatedListing.title}»`,
            type: "listing_approved",
          }
          : status === "rejected"
            ? {
              title: "تم رفض إعلانك.",
              body: [
                `اسم الإعلان: «${updatedListing.title}»`,
                reason ? `سبب الرفض: ${reason}` : null,
              ].filter(Boolean).join("\n"),
              type: "listing_rejected",
            }
            : {
              title: status === "suspended" ? "تم إيقاف إعلانك" : "تم تحديث حالة إعلانك",
              body: reason
                ? `${updatedListing.title}: ${reason}`
                : `تم تحديث حالة «${updatedListing.title}» إلى ${status}.`,
              type: "listing_status",
            };

        await tx.insert(notificationsTable).values({
          userId: updatedListing.sellerId,
          listingId: updatedListing.id,
          ...notification,
        });
      }

      return { kind: "updated", listing: updatedListing };
    });
  } catch (error) {
    if (error instanceof Error && error.message === "LISTING_PAYMENT_NOT_CONFIRMED") {
      res.status(409).json({ error: "Listing cannot be activated before payment is confirmed" });
      return;
    }
    throw error;
  }

  if (result.kind === "not_found") {
    res.status(404).json({ error: "Listing not found" });
    return;
  }
  if (result.kind === "conflict") {
    res.status(409).json({ error: "Listing status changed. Refresh and try again." });
    return;
  }

  await audit(req, `listing.${status}`, "listing", id, { reason: reason || null });
  res.json(withoutListingExpiration(result.listing));
});

router.patch("/admin/listings/:id/featured", async (req, res): Promise<void> => {
  const id = numeric(req.params.id);
  const requestedFeatured = Boolean(req.body?.featured);
  const requestedPinned = requestedFeatured && Boolean(req.body?.pinned);

  if (requestedFeatured) {
    // Admin-panel featuring is a free editorial override, independent of the
    // paid-packages system — it only requires the listing to be active.
    const [eligibleListing] = await db
      .select({ id: listingsTable.id })
      .from(listingsTable)
      .where(and(eq(listingsTable.id, id), eq(listingsTable.status, "active")))
      .limit(1);
    if (!eligibleListing) {
      res.status(409).json({ error: "Only an active listing can be featured" });
      return;
    }
  }

  const [listing] = await db.update(listingsTable).set({ featured: requestedFeatured, pinned: requestedPinned }).where(eq(listingsTable.id, id)).returning();
  if (!listing) {
    res.status(404).json({ error: "Listing not found" });
    return;
  }
  await audit(req, "listing.promote", "listing", id, { featured: listing.featured, pinned: listing.pinned });
  res.json(withoutListingExpiration(listing));
});

router.delete("/admin/listings/:id", async (req, res): Promise<void> => {
  const id = numeric(req.params.id);
  const [listing] = await db.update(listingsTable).set({ status: "suspended", moderationReason: "تمت الإزالة بواسطة الإدارة", moderatedBy: resActor(req)?.id ?? null, moderatedAt: new Date() }).where(eq(listingsTable.id, id)).returning();
  if (!listing) {
    res.status(404).json({ error: "Listing not found" });
    return;
  }
  await audit(req, "listing.delete", "listing", id, { title: listing.title });
  res.sendStatus(204);
});

router.get("/admin/users", async (req, res): Promise<void> => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const status = typeof req.query.status === "string" && req.query.status ? req.query.status : undefined;
  const filters = [q ? or(ilike(usersTable.name, `%${q}%`), ilike(usersTable.phone, `%${q}%`)) : undefined, status ? eq(usersTable.status, status) : undefined].filter(Boolean);
  const where = filters.length ? and(...filters as [ReturnType<typeof eq>, ...ReturnType<typeof eq>[]]) : undefined;
  const users = await db.select({ user: usersTable, listings: count(listingsTable.id) }).from(usersTable).leftJoin(listingsTable, eq(usersTable.id, listingsTable.sellerId)).where(where).groupBy(usersTable.id).orderBy(desc(usersTable.createdAt));
  res.json({ items: users.map(({ user, listings }) => ({ ...user, listingCount: numeric(listings) })) });
});

router.patch("/admin/users/:id/verification", async (req, res): Promise<void> => {
  const actor = resActor(req);
  if (!isAdminActor(actor)) {
    sendAdminNotFound(res);
    return;
  }

  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id < 1) {
    res.status(400).json({ error: "User id must be a positive integer" });
    return;
  }

  const parsed = userVerificationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { userId: actorClerkUserId } = getAuth(req);
  const result = await db.transaction(async (tx) => {
    const [currentUser] = await tx
      .select({ id: usersTable.id, name: usersTable.name, verified: usersTable.verified })
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .limit(1)
      .for("update");
    if (!currentUser) return null;

    if (currentUser.verified === parsed.data.verified) {
      return { id: currentUser.id, verified: currentUser.verified };
    }

    const [updatedUser] = await tx
      .update(usersTable)
      .set({ verified: parsed.data.verified })
      .where(eq(usersTable.id, id))
      .returning({ id: usersTable.id, verified: usersTable.verified });
    if (!updatedUser) return null;

    await tx.insert(auditLogsTable).values({
      actorId: actor.id,
      actorClerkUserId: actorClerkUserId ?? null,
      action: parsed.data.verified ? "user.verified" : "user.unverified",
      resourceType: "user",
      resourceId: id,
      details: { verified: updatedUser.verified, name: currentUser.name },
    });

    return updatedUser;
  });

  if (!result) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json(result);
});

router.patch("/admin/users/:id/status", async (req, res): Promise<void> => {
  const id = numeric(req.params.id);
  const status = req.body?.status;
  if (status !== "active" && status !== "suspended") {
    res.status(400).json({ error: "User status must be active or suspended" });
    return;
  }
  const [user] = await db.update(usersTable).set({ status }).where(eq(usersTable.id, id)).returning();
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  await audit(req, `user.${status}`, "user", id);
  res.json(user);
});

router.get("/admin/payments", async (req, res): Promise<void> => {
  const requestedStatus = typeof req.query.status === "string" ? req.query.status : "";
  const status = ["pending", "confirmed", "rejected", "withdrawn"].includes(requestedStatus)
    ? requestedStatus
    : undefined;
  const payments = await db.select({ payment: paymentsTable, user: usersTable, listing: listingsTable, package: paymentPackagesTable, method: paymentMethodsTable }).from(paymentsTable).leftJoin(usersTable, eq(paymentsTable.userId, usersTable.id)).leftJoin(listingsTable, eq(paymentsTable.listingId, listingsTable.id)).leftJoin(paymentPackagesTable, eq(paymentsTable.packageId, paymentPackagesTable.id)).leftJoin(paymentMethodsTable, eq(paymentsTable.paymentMethodId, paymentMethodsTable.id)).where(status ? eq(paymentsTable.status, status) : undefined).orderBy(desc(paymentsTable.createdAt));
  res.json({ items: payments.map(({ payment, user, listing, package: pkg, method }) => ({
    ...payment,
    user: user ? { id: user.id, name: user.name, email: user.email, phone: user.phone } : null,
     listing: listing ? { id: listing.id, title: listing.title, status: listing.status, createdAt: listing.createdAt } : null,
    package: pkg,
    method,
     proofImageUrl: payment.proofImageUrl?.startsWith("/objects/")
       ? `/api/admin/payments/${payment.id}/proof`
       : null,
  })) });
});

router.get("/admin/payments/:id/proof", async (req, res): Promise<void> => {
  const id = numeric(req.params.id);
  const [payment] = await db.select({ proofImageUrl: paymentsTable.proofImageUrl }).from(paymentsTable).where(eq(paymentsTable.id, id));
  if (!payment?.proofImageUrl?.startsWith("/objects/")) {
    res.status(404).json({ error: "Payment proof not found" });
    return;
  }

  let response: globalThis.Response;
  try {
    response = await loadPaymentProofResponse({
      objectPath: payment.proofImageUrl,
      storage: objectStorageService,
    });
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "Payment proof not found" });
      return;
    }
    req.log.error({ err: error }, "Failed to serve payment proof");
    res.status(503).json({ error: "Payment proof storage is unavailable" });
    return;
  }

  if (response.ok) {
    await audit(req, "payment.proof_viewed", "payment", id);
  }
  res.status(response.status);
  response.headers.forEach((value, key) => res.setHeader(key, value));
  if (response.body) {
    Readable.fromWeb(response.body as ReadableStream<Uint8Array>).pipe(res);
  } else {
    res.end();
  }
});

router.patch("/admin/payments/:id/status", async (req, res): Promise<void> => {
  const id = numeric(req.params.id);
  const status = typeof req.body?.status === "string" ? req.body.status : "";
  if (!id || !["confirmed", "rejected"].includes(status)) {
    res.status(400).json({ error: "Invalid payment status" });
    return;
  }
  const [existing] = await db.select().from(paymentsTable).where(eq(paymentsTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Payment not found" });
    return;
  }
  if (existing.status !== "pending") {
    res.status(409).json({ error: "Payment has already been reviewed" });
    return;
  }

  try {
    const actor = resActor(req);
    const payment = await db.transaction(async (tx) => {
      const [updated] = await tx.update(paymentsTable).set({
        status,
        rejectionReason: status === "rejected" ? String(req.body.reason || "") : null,
        reviewedBy: actor?.id ?? null,
        reviewedAt: new Date(),
      }).where(and(eq(paymentsTable.id, id), eq(paymentsTable.status, "pending"))).returning();
      if (!updated) throw new Error("PAYMENT_ALREADY_REVIEWED");

       if (status === "confirmed") {
        if (!updated.listingId || !updated.packageId) throw new Error("PAYMENT_MISSING_ENTITLEMENT");
        const [paymentPackage] = await tx.select().from(paymentPackagesTable).where(eq(paymentPackagesTable.id, updated.packageId));
        if (!paymentPackage) throw new Error("PAYMENT_PACKAGE_NOT_FOUND");
         const [listing] = await tx
           .select({ revision: listingsTable.revision })
           .from(listingsTable)
           .where(eq(listingsTable.id, updated.listingId))
           .limit(1);
         if (!listing || updated.listingRevision !== listing.revision) {
           throw new Error("PAYMENT_STALE_REVISION");
         }
         await tx.update(listingsTable)
           .set({
             expiresAt: new Date(Date.now() + paymentPackage.durationDays * 24 * 60 * 60 * 1000),
           })
           .where(eq(listingsTable.id, updated.listingId));
       } else if (updated.listingId) {
         const [listing] = await tx
           .select({ status: listingsTable.status })
           .from(listingsTable)
           .where(eq(listingsTable.id, updated.listingId))
           .limit(1);
         if (listing && listing.status !== "active") {
           await tx
             .update(listingsTable)
             .set({
               status: "rejected",
               moderationReason: String(req.body.reason || "تم رفض إثبات الدفع"),
               moderatedBy: actor?.id ?? null,
               moderatedAt: new Date(),
             })
             .where(eq(listingsTable.id, updated.listingId));
         }
      }

       if (updated.userId !== null) {
         await tx.insert(notificationsTable).values({
           userId: updated.userId,
           listingId: updated.listingId,
           paymentId: updated.id,
           title: status === "confirmed" ? "تم تأكيد الدفع" : "تم رفض الدفع",
           body: status === "rejected" && req.body.reason ? String(req.body.reason) : `تم تحديث طلب الدفع رقم ${updated.id}.`,
           type: "payment_status",
         });
       }
      await tx.insert(auditLogsTable).values({
        actorId: actor?.id ?? null,
        actorClerkUserId: actor?.clerkUserId ?? null,
        action: `payment.${status}`,
        resourceType: "payment",
        resourceId: id,
        details: { reason: req.body.reason || null },
      });
      return updated;
    });
    res.json(payment);
  } catch (error) {
    if (error instanceof Error && error.message === "PAYMENT_ALREADY_REVIEWED") {
      res.status(409).json({ error: "Payment has already been reviewed" });
      return;
    }
    if (error instanceof Error && ["PAYMENT_MISSING_ENTITLEMENT", "PAYMENT_PACKAGE_NOT_FOUND", "PAYMENT_STALE_REVISION"].includes(error.message)) {
      if (error.message === "PAYMENT_STALE_REVISION") {
        res.status(409).json({ error: "This payment belongs to an older version of the listing" });
        return;
      }
      res.status(422).json({ error: "Payment is missing a valid listing or package" });
      return;
    }
    throw error;
  }
});

router.get("/admin/packages", async (_req, res): Promise<void> => {
  res.json({ items: await db.select().from(paymentPackagesTable).orderBy(asc(paymentPackagesTable.createdAt)) });
});

router.post("/admin/packages", async (req, res): Promise<void> => {
  const parsed = paymentPackageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payment package payload" });
    return;
  }
  const [pkg] = await db.insert(paymentPackagesTable).values({ ...parsed.data, price: String(parsed.data.price), currency: "MRU" }).returning();
  await audit(req, "package.create", "package", pkg.id);
  res.status(201).json(pkg);
});

router.patch("/admin/packages/:id", async (req, res): Promise<void> => {
  const parsed = paymentPackageUpdate.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payment package payload" });
    return;
  }
  const [pkg] = await db.update(paymentPackagesTable).set({ ...parsed.data, price: parsed.data.price == null ? undefined : String(parsed.data.price), currency: "MRU" }).where(eq(paymentPackagesTable.id, numeric(req.params.id))).returning();
  if (!pkg) {
    res.status(404).json({ error: "Package not found" });
    return;
  }
  await audit(req, "package.update", "package", pkg.id);
  res.json(pkg);
});

router.delete("/admin/packages/:id", async (req, res): Promise<void> => {
  const [pkg] = await db.update(paymentPackagesTable).set({ active: false }).where(eq(paymentPackagesTable.id, numeric(req.params.id))).returning();
  if (!pkg) {
    res.status(404).json({ error: "Package not found" });
    return;
  }
  await audit(req, "package.delete", "package", pkg.id);
  res.sendStatus(204);
});

router.get("/admin/payment-methods", async (_req, res): Promise<void> => {
  res.json({ items: await db.select().from(paymentMethodsTable).orderBy(asc(paymentMethodsTable.createdAt)) });
});

router.post("/admin/payment-methods", async (req, res): Promise<void> => {
  const parsed = paymentMethodBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payment method payload" });
    return;
  }
  const [method] = await db.insert(paymentMethodsTable).values({ ...parsed.data, currency: "MRU" }).returning();
  await audit(req, "payment_method.create", "payment_method", method.id);
  res.status(201).json(method);
});

router.patch("/admin/payment-methods/:id", async (req, res): Promise<void> => {
  const parsed = paymentMethodUpdate.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payment method payload" });
    return;
  }
  const [method] = await db.update(paymentMethodsTable).set({ ...parsed.data, currency: "MRU" }).where(eq(paymentMethodsTable.id, numeric(req.params.id))).returning();
  if (!method) {
    res.status(404).json({ error: "Payment method not found" });
    return;
  }
  await audit(req, "payment_method.update", "payment_method", method.id);
  res.json(method);
});

router.delete("/admin/payment-methods/:id", async (req, res): Promise<void> => {
  const [method] = await db.update(paymentMethodsTable).set({ active: false }).where(eq(paymentMethodsTable.id, numeric(req.params.id))).returning();
  if (!method) {
    res.status(404).json({ error: "Payment method not found" });
    return;
  }
  await audit(req, "payment_method.delete", "payment_method", method.id);
  res.sendStatus(204);
});

router.get("/admin/reports", async (_req, res): Promise<void> => {
  const reports = await db.select({ report: reportsTable, reporter: usersTable, listing: listingsTable }).from(reportsTable).innerJoin(usersTable, eq(reportsTable.reporterId, usersTable.id)).leftJoin(listingsTable, eq(reportsTable.listingId, listingsTable.id)).orderBy(desc(reportsTable.createdAt));
  res.json({ items: reports.map(({ report, reporter, listing }) => ({
    ...report,
    reporter: { id: reporter.id, name: reporter.name, email: reporter.email, phone: reporter.phone },
    listing: listing ? { id: listing.id, title: listing.title } : null,
  })) });
});

router.get("/admin/support-settings", async (_req, res): Promise<void> => {
  const [settings] = await db.select().from(supportSettingsTable).where(eq(supportSettingsTable.id, 1)).limit(1);
  res.json({
    phone: settings?.phone ?? "",
    whatsappPhone: settings?.whatsappPhone ?? "",
    updatedAt: settings?.updatedAt ?? null,
  });
});

router.patch("/admin/support-settings", async (req, res): Promise<void> => {
  const phone = typeof req.body?.phone === "string" ? req.body.phone.trim() : "";
  const whatsappPhone = typeof req.body?.whatsappPhone === "string" ? req.body.whatsappPhone.trim() : "";
  if (phone.length > 80 || whatsappPhone.length > 80) {
    res.status(400).json({ error: "Support phone numbers must be 80 characters or fewer" });
    return;
  }
  const invalidPhoneField = invalidSupportPhoneField({ phone, whatsappPhone });
  if (invalidPhoneField) {
    res.status(400).json({
      error: "Phone numbers must contain eight digits and start with 2, 3, or 4",
      field: invalidPhoneField,
    });
    return;
  }
  const [settings] = await db.insert(supportSettingsTable).values({
    id: 1,
    phone,
    whatsappPhone,
    updatedBy: resActor(req)?.id ?? null,
  }).onConflictDoUpdate({
    target: supportSettingsTable.id,
    set: { phone, whatsappPhone, updatedBy: resActor(req)?.id ?? null, updatedAt: new Date() },
  }).returning();
  await audit(req, "support_settings.update", "support_settings", settings.id);
  res.json({
    phone: settings.phone,
    whatsappPhone: settings.whatsappPhone,
    updatedAt: settings.updatedAt,
  });
});

router.patch("/admin/reports/:id", async (req, res): Promise<void> => {
  const status = req.body?.status === "resolved" ? "resolved" : "open";
  const action = typeof req.body?.action === "string" ? req.body.action.trim() : "";
  const reportId = numeric(req.params.id);
  const actor = resActor(req);
  const result = await db.transaction(async (tx) => {
    const [updatedReport] = await tx.update(reportsTable)
      .set({
        status,
        action: action || null,
        resolvedBy: status === "resolved" ? actor?.id ?? null : null,
        resolvedAt: status === "resolved" ? new Date() : null,
      })
      .where(eq(reportsTable.id, reportId))
      .returning();
    if (!updatedReport) return null;

    if (action) {
      await tx.insert(notificationsTable).values({
        userId: updatedReport.reporterId,
        reportId: updatedReport.id,
        title: "تم الرد على بلاغك",
        body: action,
        type: "report_reply",
        read: false,
      });
    }

    return updatedReport;
  });
  const report = result;
  if (!report) {
    res.status(404).json({ error: "Report not found" });
    return;
  }
  await audit(req, `report.${status}`, "report", report.id, { action: report.action });
  res.json(report);
});

router.get("/admin/audit-logs", async (_req, res): Promise<void> => {
  res.json({ items: await db.select().from(auditLogsTable).orderBy(desc(auditLogsTable.createdAt)).limit(200) });
});

export default router;
