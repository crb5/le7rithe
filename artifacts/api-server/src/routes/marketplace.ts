import express, { Router, type IRouter, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import {
  InvalidListingImageError, LISTING_IMAGE_MAX_BYTES, LISTING_IMAGE_TYPES,
  isOwnedListingImageInput, listingImageInputId, processListingImage,
  readListingImageInput, withListingImageProcessing,
  canonicalListingImageReference,
} from "../lib/listing-image-processing";
import { clerkClient, getAuth } from "@clerk/express";
import { and, asc, count, desc, eq, gt, gte, ilike, isNotNull, isNull, lte, ne, notIlike, or, sql, type SQL } from "drizzle-orm";
import type { Logger } from "pino";
import { ENABLE_PAID_LISTINGS } from "../lib/features";
import { adminRouteAccessFailure } from "../lib/admin-route-access";
import {
  db,
  adminSessionsTable,
  auditLogsTable,
  bannersTable,
  categoriesTable,
  listingsTable,
  listingSaleEventsTable,
  messagesTable,
  notificationsTable,
  paymentMethodsTable,
  paymentPackagesTable,
  paymentsTable,
  reportsTable,
  rentalSeasonSettingsTable,
  savedListingsTable,
  subcategoriesTable,
  supportSettingsTable,
  usersTable,
} from "@workspace/db";
import {
  CreateCategoryBody,
  CreateCategoryResponse,
  CreateListingBody,
  CreateListingResponse,
  CreateSubcategoryBody,
  CreateSubcategoryParams,
  CreateSubcategoryResponse,
  DeleteCategoryParams,
  DeleteSubcategoryParams,
  DeleteListingParams,
  GetDashboardSummaryResponse,
  GetMyAccountProfileResponse,
  GetMarketPulseResponse,
  GetListingParams,
  GetListingResponse,
  ListAdminCategoriesResponse,
  ListCategoriesResponse,
  ListListingsQueryParams,
  ListListingsResponse,
  ListLocationsResponse,
  ListMessagesResponse,
  ListSavedListingsResponse,
  ListSellerActiveListingsResponse,
  MarkMessageReadResponse,
  ListSubcategoriesParams,
  ListSubcategoriesResponse,
  SendMessageBody,
  SendMessageResponse,
  GetSupportSettingsResponse,
  SendSupportMessageBody,
  SendSupportMessageResponse,
  SetListingFavoriteBody,
  SetListingFavoriteParams,
  SetListingFavoriteResponse,
  UpdateMyAccountProfileBody,
  UpdateMyAccountProfileResponse,
  UpdateCategoryBody,
  UpdateCategoryParams,
  UpdateCategoryResponse,
  UpdateListingBody,
  UpdateListingParams,
  UpdateListingResponse,
  ProcessListingImageUploadBody,
  ProcessListingImageUploadResponse,
  UpdateSubcategoryBody,
  UpdateSubcategoryParams,
  UpdateSubcategoryResponse,
} from "@workspace/api-zod";
import { ObjectNotFoundError, ObjectStorageService } from "../lib/objectStorage";
import { deleteMarketplaceAccount } from "../lib/privacy-deletion";
import { createMarketplaceAccountDeletionStore } from "../lib/privacy-deletion-store";
import { canRevertSale, saleRevertUntil } from "../lib/listing-sale";
import { listingFromBody, publishedListingUpdateValues } from "../lib/listing-data";
import { EDIT_WINDOW_MS, LISTING_CONTENT_EDIT_CLOSED_ERROR, listingContentEditRestriction } from "@workspace/api-zod/listing-edit-window";
import {
  getListingImageAccessPolicy,
  listingImageRequiresConsent,
} from "../lib/listing-image-access";
import { normalizeListingPhones } from "../lib/mauritania-phone";
import {
  hasCurrentLegalConsentForClerkUser,
  requireCurrentLegalConsent,
} from "../lib/legal-consent-store";
import { getAdminSessionCookie, hashAdminSessionToken } from "../lib/admin-auth";
import { shouldRunMarketplaceDemoSeed } from "../lib/marketplace-seed-policy";
import { provisionLocalAccount } from "../lib/local-account-provisioning";
import {
  InvalidPaymentProofImageError,
  createPaymentProofUploadId,
  isPaymentProofObjectPath,
  isPaymentProofOwnedByUser,
  maxPaymentProofBytes,
  paymentProofContentTypes,
  validatePaymentProofMetadata,
} from "../lib/paymentProof";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();
const accountDeletionStore = createMarketplaceAccountDeletionStore(objectStorageService);

const authenticatedMarketplaceUser = async (req: Request, res: Response) => {
  const auth = getAuth(req);
  if (!auth.userId) {
    res.status(401).json({ error: "Authentication required" });
    return null;
  }
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.clerkUserId, auth.userId));
  if (existing) {
    if (existing.status !== "active") {
      res.status(403).json({ error: "Account is suspended" });
      return null;
    }
  }
  if (!(await requireCurrentLegalConsent(auth.userId, res))) return null;
  const claims = (auth.sessionClaims || {}) as Record<string, unknown>;
  const displayName = typeof claims.name === "string"
    ? claims.name
    : typeof claims.first_name === "string"
      ? String(claims.first_name)
      : "مستخدم";
  const email = typeof claims.email === "string" ? claims.email : null;
  return provisionLocalAccount({
    clerkUserId: auth.userId,
    existing: existing ?? null,
    fallbackName: displayName,
    fallbackEmail: email,
    allowedEmails: process.env.ADMIN_ALLOWED_EMAILS,
  }, {
    loadClerkUser: () => clerkClient.users.getUser(auth.userId!),
    reconnectAdministrator: verifiedEmail => db.transaction(async tx => {
      // Share the admin bootstrap lock: first marketplace use must preserve
      // the same local owner/password as first use of the admin routes.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('marketplace_admin_bootstrap'))`);
      const [concurrent] = await tx.select().from(usersTable)
        .where(eq(usersTable.clerkUserId, auth.userId!)).limit(1);
      if (concurrent) {
        if (concurrent.status !== "active") throw new Error("Local administrator is inactive");
        const [promoted] = await tx.update(usersTable)
          .set({ role: "admin", email: verifiedEmail })
          .where(eq(usersTable.id, concurrent.id)).returning();
        return promoted;
      }
      const legacyActors = await tx.select().from(usersTable).where(and(
        eq(usersTable.role, "admin"),
        sql`lower(trim(${usersTable.email})) = ${verifiedEmail}`,
      )).limit(2);
      if (legacyActors.length > 1) throw new Error("Ambiguous local administrator identity");
      const legacyActor = legacyActors[0];
      if (!legacyActor) return null;
      if (legacyActor.status !== "active") throw new Error("Local administrator is inactive");
      const [reconnected] = await tx.update(usersTable)
        .set({ clerkUserId: auth.userId!, email: verifiedEmail })
        .where(eq(usersTable.id, legacyActor.id)).returning();
      return reconnected;
    }),
    create: async values => {
      const [created] = await db.insert(usersTable).values(values)
        .onConflictDoUpdate({
          target: usersTable.clerkUserId,
          set: values.role === "admin" ? { role: "admin", email: values.email } : { clerkUserId: values.clerkUserId },
          setWhere: eq(usersTable.status, "active"),
        }).returning();
      if (!created) throw new Error("Local account provisioning failed");
      return created;
    },
    promote: async (account, verifiedEmail) => {
      const [updated] = await db.update(usersTable)
        .set({ role: "admin", email: verifiedEmail })
        .where(and(eq(usersTable.id, account.id), eq(usersTable.status, "active")))
        .returning();
      if (!updated) throw new Error("Local administrator provisioning failed");
      return updated;
    },
  });
};

const requireAdminForMarketplace = async (
  req: Request,
  res: Response,
  next: (error?: unknown) => void,
): Promise<void> => {
  const { userId } = getAuth(req);
  const [actor] = userId
    ? await db.select().from(usersTable).where(eq(usersTable.clerkUserId, userId)).limit(1)
    : [];
  const actorFailure = adminRouteAccessFailure(actor ?? null, false);
  if (actorFailure?.status === 404) {
    res.status(actorFailure.status).json({ error: actorFailure.error });
    return;
  }
  const token = getAdminSessionCookie(req);
  if (!token) {
    const sessionFailure = adminRouteAccessFailure(actor ?? null, false);
    if (sessionFailure) {
      res.status(sessionFailure.status).json({ error: sessionFailure.error });
    }
    return;
  }
  const [session] = await db.select({ id: adminSessionsTable.id })
    .from(adminSessionsTable)
    .where(and(
      eq(adminSessionsTable.userId, actor.id),
      eq(adminSessionsTable.tokenHash, hashAdminSessionToken(token)),
      isNull(adminSessionsTable.revokedAt),
      gt(adminSessionsTable.expiresAt, new Date()),
    ))
    .limit(1);
  const accessFailure = adminRouteAccessFailure(actor ?? null, Boolean(session));
  if (accessFailure) {
    res.status(accessFailure.status).json({ error: accessFailure.error });
    return;
  }
  if (!(await requireCurrentLegalConsent(userId, res))) return;
  next();
};

router.use("/admin/categories", requireAdminForMarketplace);
router.use("/admin/subcategories", requireAdminForMarketplace);

const marketplaceUserForRequest = async (req: Request) => {
  const { userId } = getAuth(req);
  if (!userId) return null;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.clerkUserId, userId));
  return user ?? null;
};

const parsePaymentId = (value: unknown) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const listingImageMaxBytes = LISTING_IMAGE_MAX_BYTES;
const listingImageContentTypes = LISTING_IMAGE_TYPES;
const listingImageObjectPath = /^\/objects\/listing-images\/[0-9a-f-]{36}$/i;
// Uploaded proofs are retained for one day after upload before an unreferenced
// object becomes eligible for cleanup, allowing a user to finish the form.
const paymentProofCleanupGracePeriodMs = 24 * 60 * 60 * 1000;
const paymentProofCleanupMinIntervalMs = 60 * 60 * 1000;
const validatePaymentProofObjectPath = (value: unknown) =>
  isPaymentProofObjectPath(value) ? value : null;

const paymentProofIsAvailable = async (objectPath: string | null): Promise<boolean> => {
  if (!isPaymentProofObjectPath(objectPath)) return false;
  try {
    await objectStorageService.getObjectEntityFile(objectPath);
    return true;
  } catch {
    return false;
  }
};

const validateListingImageMetadata = (body: unknown) => {
  if (!body || typeof body !== "object") return false;
  const input = body as Record<string, unknown>;
  return (
    typeof input.name === "string" &&
    input.name.trim().length > 0 &&
    typeof input.size === "number" &&
    Number.isInteger(input.size) &&
    input.size > 0 &&
    input.size <= listingImageMaxBytes &&
    typeof input.contentType === "string" &&
    listingImageContentTypes.has(input.contentType)
  );
};

const validateListingImageObjectPath = (value: unknown) =>
  typeof value === "string" && listingImageObjectPath.test(value) ? value : null;

export const imageUrlForClient = (value: string) =>
  value.startsWith("/objects/listing-images/") ? `/api/listing-images/${value.split("/").pop()}` : value;

export const bannerImageUrlForClient = (id: number) => `/api/banners/${id}/image`;

const secureListingImageObjects = async (paths: string[], owner: string) => {
  if (paths.length > 8) throw new Error("A listing can contain at most 8 images");
  for (const path of paths) {
    if (path.startsWith("/objects/listing-image-inputs/")) throw new Error("Image processing has not completed");
    const objectPath = validateListingImageObjectPath(path);
    if (!objectPath) continue;
    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
    const [metadata] = await objectFile.getMetadata();
    const contentType = typeof metadata.contentType === "string" ? metadata.contentType : "";
    const size = Number(metadata.size);
    if (!listingImageContentTypes.has(contentType) || !Number.isFinite(size) || size <= 0 || size > listingImageMaxBytes) {
      throw new Error("Invalid listing image file");
    }
    if (metadata.metadata?.listingImageVersion === "1") {
      const policy = JSON.parse(String(metadata.metadata["custom:aclPolicy"] ?? "{}"));
      if (policy.owner !== owner) throw new Error("Image belongs to another user");
    } else {
      await objectStorageService.markObjectPrivate(objectPath, owner);
    }
  }
};

let paymentProofCleanupLastStartedAt = 0;
let paymentProofCleanupPromise: Promise<void> | undefined;

export const cleanupAbandonedPaymentProofs = (log: Pick<Logger, "error" | "info">): void => {
  const now = Date.now();
  if (
    paymentProofCleanupPromise ||
    now - paymentProofCleanupLastStartedAt < paymentProofCleanupMinIntervalMs
  ) {
    return;
  }

  paymentProofCleanupLastStartedAt = now;
  paymentProofCleanupPromise = (async () => {
    const referencedProofs = await db
      .select({ objectPath: paymentsTable.proofImageUrl })
      .from(paymentsTable)
      .where(isNotNull(paymentsTable.proofImageUrl));
    const result = await objectStorageService.cleanupUnreferencedPaymentProofs({
      referencedObjectPaths: new Set(
        referencedProofs.flatMap(({ objectPath }) =>
          objectPath ? [objectPath] : [],
        ),
      ),
      olderThan: new Date(now - paymentProofCleanupGracePeriodMs),
    });

    if (result.failedObjectPaths.length > 0) {
      log.error(
        {
          scanned: result.scanned,
          deleted: result.deleted,
          failedObjectPaths: result.failedObjectPaths,
        },
        "Failed to remove abandoned payment proof objects",
      );
    } else if (result.deleted > 0) {
      log.info(
        { scanned: result.scanned, deleted: result.deleted },
        "Removed abandoned payment proof objects",
      );
    }
  })()
    .catch((error) => {
      log.error({ err: error }, "Failed to clean up abandoned payment proofs");
    })
    .finally(() => {
      paymentProofCleanupPromise = undefined;
    });
};

let seedPromise: Promise<void> | undefined;
let rentalSeasonSettingsPromise: Promise<void> | undefined;

const categoryCatalog = [
  { name: "الأراضي الزراعية", nameFr: "Terrains agricoles", nameEn: "Agricultural land", slug: "land", icon: "land", subcategories: [{ name: "للبيع", nameFr: "À vendre", nameEn: "For sale", slug: "land-sale" }, { name: "للإيجار", nameFr: "À louer", nameEn: "For rent", slug: "land-rent" }] },
  { name: "الآليات الزراعية", nameFr: "Machines agricoles", nameEn: "Agricultural machinery", slug: "tractors", icon: "tractor", subcategories: [{ name: "جرار", nameFr: "Tracteur", nameEn: "Tractor", slug: "tractor" }, { name: "حاصدة", nameFr: "Moissonneuse", nameEn: "Harvester", slug: "harvester" }, { name: "محراث", nameFr: "Offset", nameEn: "Plough", slug: "plough" }, { name: "بذارة", nameFr: "Semoir", nameEn: "Seeder", slug: "seeder" }, { name: "مقطورة", nameFr: "Remorque", nameEn: "Trailer", slug: "trailer" }, { name: "آخر", nameFr: "Autre", nameEn: "Other", slug: "machinery-other" }] },
  { name: "البذور", nameFr: "Semences", nameEn: "Seeds", slug: "seeds", icon: "wheat", subcategories: [{ name: "أرز — فئة ثلاثة أشهر", nameFr: "Riz — trois mois", nameEn: "Rice — three months", slug: "rice-three-months" }, { name: "أرز — فئة أربعة أشهر", nameFr: "Riz — quatre mois", nameEn: "Rice — four months", slug: "rice-four-months" }, { name: "الخضروات", nameFr: "Légumes", nameEn: "Vegetables", slug: "vegetable-seeds" }, { name: "بذور الأعلاف", nameFr: "Fourrage", nameEn: "Feed seeds", slug: "feed-seeds" }] },
  { name: "الأسمدة", nameFr: "Engrais", nameEn: "Fertilizers", slug: "fertilizers", icon: "flask", subcategories: [{ name: "أسمدة عناصر كبرى NPK", nameFr: "Engrais NPK", nameEn: "NPK fertilizers", slug: "npk" }, { name: "أسمدة عناصر صغرى", nameFr: "Oligo-éléments", nameEn: "Micronutrients", slug: "micronutrients" }, { name: "أسمدة ورقية", nameFr: "Engrais foliaires", nameEn: "Foliar fertilizers", slug: "foliar" }] },
  { name: "قطع غيار الآليات الزراعية", nameFr: "Pièces détachées", nameEn: "Agricultural spare parts", slug: "parts", icon: "wrench", subcategories: [{ name: "قطع جرارات", nameFr: "Pièces de tracteurs", nameEn: "Tractor parts", slug: "tractor-parts" }, { name: "قطع مضخات", nameFr: "Pièces de pompes", nameEn: "Pump parts", slug: "pump-parts" }, { name: "آخر", nameFr: "Autre", nameEn: "Other", slug: "parts-other" }] },
  { name: "تسويق المنتجات الزراعية", nameFr: "Produits agricoles", nameEn: "Agricultural products", slug: "products", icon: "basket", subcategories: [{ name: "الأرز", nameFr: "Riz", nameEn: "Rice", slug: "rice" }, { name: "الخضروات", nameFr: "Légumes", nameEn: "Vegetables", slug: "vegetables" }, { name: "الأعلاف", nameFr: "Fourrage", nameEn: "Feed", slug: "feed" }] },
  { name: "الموارد البشرية الزراعية", nameFr: "Ressources humaines agricoles", nameEn: "Agricultural human resources", slug: "services", icon: "users", subcategories: [{ name: "مكتب دراسات", nameFr: "Bureau d'études", nameEn: "Consulting office", slug: "study-office" }, { name: "خبير", nameFr: "Expert", nameEn: "Expert", slug: "expert" }, { name: "مهندس", nameFr: "Ingénieur", nameEn: "Engineer", slug: "engineer" }, { name: "فني", nameFr: "Technicien", nameEn: "Technician", slug: "technician" }, { name: "عامل", nameFr: "Ouvrier", nameEn: "Worker", slug: "worker" }] },
  { name: "متنوع", nameFr: "Divers", nameEn: "Miscellaneous", slug: "divers", icon: "leaf", subcategories: [] },
] as const;

const seedDatabase = async (): Promise<void> => {
  const [{ total: userTotal }] = await db.select({ total: count() }).from(usersTable);
  if (Number(userTotal) === 0) {
    await db.insert(usersTable).values([
      { name: "مزرعة الخير", initials: "م خ", phone: "+222 36 12 45 67", verified: true },
      { name: "أحمد ولد محمد", initials: "أ م", phone: "+222 41 22 33 44", verified: true },
    ]);
  }

  for (const [sortOrder, item] of categoryCatalog.entries()) {
    const [category] = await db.insert(categoriesTable).values({
      name: item.name,
      nameFr: item.nameFr,
      nameEn: item.nameEn,
      slug: item.slug,
      icon: item.icon,
      sortOrder,
      active: true,
    }).onConflictDoUpdate({
      target: categoriesTable.slug,
      set: { name: item.name, nameFr: item.nameFr, nameEn: item.nameEn, icon: item.icon, sortOrder, active: true },
    }).returning();
    for (const [subcategoryOrder, subcategory] of item.subcategories.entries()) {
      await db.insert(subcategoriesTable).values({
        categoryId: category.id,
        name: subcategory.name,
        nameFr: subcategory.nameFr,
        nameEn: subcategory.nameEn,
        slug: subcategory.slug,
        sortOrder: subcategoryOrder,
        active: true,
      }).onConflictDoUpdate({
        target: subcategoriesTable.slug,
        set: { categoryId: category.id, name: subcategory.name, nameFr: subcategory.nameFr, nameEn: subcategory.nameEn, sortOrder: subcategoryOrder, active: true },
      });
    }
  }

  await db.update(categoriesTable).set({ active: false }).where(or(eq(categoriesTable.slug, "machines"), eq(categoriesTable.slug, "irrigation"), eq(categoriesTable.slug, "equipment")));

  const [{ total: packageTotal }] = await db.select({ total: count() }).from(paymentPackagesTable);
  if (Number(packageTotal) === 0) {
    await db.insert(paymentPackagesTable).values([
      { name: "إعلان عادي", description: "إعلان أساسي لمدة 30 يوماً", price: "500", currency: "MRU", durationDays: 30, listingType: "standard", features: ["ظهور في السوق"], featured: false, pinned: false, active: true },
      { name: "إعلان مميز", description: "ظهور أعلى وانتشار أفضل", price: "1500", currency: "MRU", durationDays: 30, listingType: "featured", features: ["ظهور مميز", "أولوية في القوائم"], featured: true, pinned: false, active: true },
      { name: "إعلان VIP", description: "تثبيت الإعلان في مقدمة السوق", price: "3000", currency: "MRU", durationDays: 45, listingType: "vip", features: ["ظهور مميز", "تثبيت الإعلان", "أولوية قصوى"], featured: true, pinned: true, active: true },
    ]);
  }
  const defaultPaymentMethods = [
    {
      name: "Bankily",
      accountNumber: "يحدده المشرف",
      accountName: "حساب السوق",
      instructions: "أرسل المبلغ ثم احتفظ برقم العملية لإرفاقه في طلب التأكيد.",
      currency: "MRU",
      active: true,
    },
    {
      name: "سداد",
      accountNumber: "يحدده المشرف",
      accountName: "حساب السوق",
      instructions: "حوّل المبلغ عبر سداد، ثم احتفظ برقم العملية لإرفاقه في طلب التأكيد.",
      currency: "MRU",
      active: true,
    },
    {
      name: "مصرفي",
      accountNumber: "يحدده المشرف",
      accountName: "حساب السوق",
      instructions: "حوّل المبلغ عبر مصرفي، ثم احتفظ برقم العملية لإرفاقه في طلب التأكيد.",
      currency: "MRU",
      active: true,
    },
  ];
  for (const defaultMethod of defaultPaymentMethods) {
    const [existingMethod] = await db.select({ id: paymentMethodsTable.id })
      .from(paymentMethodsTable)
      .where(eq(paymentMethodsTable.name, defaultMethod.name))
      .limit(1);
    if (!existingMethod) {
      await db.insert(paymentMethodsTable).values(defaultMethod);
    }
  }

  const categories = await db.select().from(categoriesTable);
  const categoryBySlug = new Map(categories.map((category) => [category.slug, category.id]));
  const subcategories = await db.select().from(subcategoriesTable);
  const subcategoryBySlug = new Map(subcategories.map((subcategory) => [subcategory.slug, subcategory.id]));
  await db.update(listingsTable).set({ subcategoryId: subcategoryBySlug.get("tractor") ?? null }).where(and(eq(listingsTable.categoryId, categoryBySlug.get("tractors")!), isNull(listingsTable.subcategoryId)));
  await db.update(listingsTable).set({ subcategoryId: subcategoryBySlug.get("land-sale") ?? null }).where(and(eq(listingsTable.categoryId, categoryBySlug.get("land")!), isNull(listingsTable.subcategoryId)));

  const [{ total: listingTotal }] = await db.select({ total: count() }).from(listingsTable);
  if (Number(listingTotal) > 0) return;
  const [seller, buyer] = await db.select().from(usersTable).orderBy(asc(usersTable.id)).limit(2);
  await db.insert(listingsTable).values([
    {
      sellerId: seller.id,
      contactPhone: "+222 36 12 45 67",
      title: "جرار Massey Ferguson 4708",
      categoryId: categoryBySlug.get("tractors")!,
      subcategoryId: subcategoryBySlug.get("tractor")!,
      price: "485000",
      currency: "MRU",
      location: "روصو، موريتانيا",
      condition: "used",
      year: 2021,
      manufacturer: "Massey Ferguson",
      model: "4708",
      hours: 1840,
      description: "جرار بحالة ممتازة، تمت صيانته بالكامل وجاهز للعمل في الحقول.",
      imageUrl: "https://images.unsplash.com/photo-1530267981375-f0de937f5f13?auto=format&fit=crop&w=1200&q=85",
      images: ["https://images.unsplash.com/photo-1530267981375-f0de937f5f13?auto=format&fit=crop&w=1200&q=85"],
      featured: true,
    },
    {
      sellerId: buyer.id,
      contactPhone: "+222 41 22 33 44",
      title: "أرض زراعية خصبة قرب نهر السنغال",
      categoryId: categoryBySlug.get("land")!,
      subcategoryId: subcategoryBySlug.get("land-sale")!,
      price: "1250000",
      currency: "MRU",
      location: "بوغي، موريتانيا",
      condition: "new",
      area: "18",
      waterAvailable: true,
      description: "أرض زراعية مساحتها 18 هكتارًا، قريبة من مصدر المياه ومناسبة للزراعة المروية.",
      imageUrl: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=85",
      images: ["https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=85"],
      featured: true,
    },
    {
      sellerId: seller.id,
      contactPhone: "+222 36 12 45 67",
      title: "مضخة مياه زراعية عالية الكفاءة",
      categoryId: categoryBySlug.get("irrigation")!,
      subcategoryId: null,
      price: "78000",
      currency: "MRU",
      location: "نواكشوط، موريتانيا",
      condition: "new",
      manufacturer: "Honda",
      model: "WB30XT",
      description: "مضخة مياه للاستخدام الزراعي، موفرة للوقود وسهلة النقل.",
      imageUrl: "https://images.unsplash.com/photo-1625246333195-78d9c38ad449?auto=format&fit=crop&w=1200&q=85",
      images: ["https://images.unsplash.com/photo-1625246333195-78d9c38ad449?auto=format&fit=crop&w=1200&q=85"],
      featured: false,
    },
  ]);
};

const ensureSeed = async (): Promise<void> => {
  rentalSeasonSettingsPromise ??= db.insert(rentalSeasonSettingsTable)
    .values({ id: 1, isOpen: true, renewalFee: "0" })
    .onConflictDoNothing()
    .then(async () => {
      await db.update(listingsTable)
        .set({
          rentalStatus: "leased",
          rentedAt: sql`COALESCE(${listingsTable.rentedAt}, ${listingsTable.soldAt})`,
        })
        .where(and(
          sql`${listingsTable.attributes}->>'saleType' = 'rent'`,
          eq(listingsTable.saleStatus, "sold"),
          eq(listingsTable.rentalStatus, "available"),
        ));
    })
    .catch((error) => {
      rentalSeasonSettingsPromise = undefined;
      throw error;
    });
  await rentalSeasonSettingsPromise;
  if (!shouldRunMarketplaceDemoSeed(
    process.env.NODE_ENV,
    process.env.ENABLE_MARKETPLACE_DEMO_SEED,
  )) return;
  seedPromise ??= seedDatabase();
  await seedPromise;
};

const parseNumeric = (value: string | number | null | undefined): number | null => {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatListing = (row: {
  listing: typeof listingsTable.$inferSelect;
  category: typeof categoriesTable.$inferSelect;
  subcategory?: typeof subcategoriesTable.$inferSelect | null;
  seller: typeof usersTable.$inferSelect;
  isSaved?: boolean;
  includeContactPhone?: boolean;
}) => ({
  id: row.listing.id,
  title: row.listing.title,
  category: row.category.name,
  categorySlug: row.category.slug,
  subcategory: row.subcategory?.name ?? null,
  subcategorySlug: row.subcategory?.slug ?? null,
  price: Number(row.listing.price),
  currency: row.listing.currency,
  location: row.listing.location,
  condition: row.listing.condition as "new" | "used",
  year: row.listing.year,
  manufacturer: row.listing.manufacturer,
  model: row.listing.model,
  hours: row.listing.hours,
  area: parseNumeric(row.listing.area),
  waterAvailable: row.listing.waterAvailable,
  electricityAvailable: row.listing.electricityAvailable,
  ownershipType: row.listing.ownershipType,
  contactPhone: row.includeContactPhone ? row.listing.contactPhone : null,
  whatsappPhone: row.includeContactPhone ? row.listing.whatsappPhone : null,
  attributes: row.listing.attributes ?? {},
  description: row.listing.description,
  imageUrl: imageUrlForClient(row.listing.imageUrl),
  images: row.listing.images.map(imageUrlForClient),
  seller: {
    id: row.seller.id,
    name: row.seller.name,
    initials: row.seller.initials,
    verified: row.seller.verified,
    phone: row.includeContactPhone ? row.listing.contactPhone : null,
  },
  createdAt: row.listing.createdAt,
  featured: row.listing.featured,
  saleStatus: row.listing.saleStatus as "available" | "sold",
  soldAt: row.listing.soldAt,
  saleRevertUntil: row.listing.soldAt ? saleRevertUntil(row.listing.soldAt) : null,
  canRevertSale: row.listing.saleStatus === "sold" && row.listing.soldAt
    ? canRevertSale(row.listing.soldAt)
    : false,
  rentalStatus: row.listing.rentalStatus,
  rentalSeasonArchivedAt: row.listing.rentalSeasonArchivedAt,
  rentalAdminHiddenAt: row.listing.rentalAdminHiddenAt,
  rentedAt: row.listing.rentedAt,
  isSaved: row.isSaved ?? false,
});

const activeListingWhere = () => and(
  eq(listingsTable.status, "active"),
  isNull(listingsTable.rentalAdminHiddenAt),
  or(
    and(
      sql`${listingsTable.attributes}->>'saleType' = 'rent'`,
      eq(listingsTable.rentalStatus, "available"),
      isNull(listingsTable.rentalSeasonArchivedAt),
      sql`EXISTS (
        SELECT 1
        FROM marketplace_rental_season_settings
        WHERE id = 1 AND is_open = true
      )`,
    ),
    and(
      sql`${listingsTable.attributes}->>'saleType' IS DISTINCT FROM 'rent'`,
      eq(listingsTable.saleStatus, "available"),
    ),
  ),
);

const publicActiveListingWhere = () => and(
  activeListingWhere(),
  notIlike(listingsTable.title, "E2E %"),
);

const activeBannerWhere = () => and(
  eq(bannersTable.active, true),
  or(
    sql`NULLIF(BTRIM(${bannersTable.title}), '') IS NOT NULL`,
    sql`NULLIF(BTRIM(${bannersTable.subtitle}), '') IS NOT NULL`,
    sql`NULLIF(BTRIM(${bannersTable.additionalText}), '') IS NOT NULL`,
    sql`NULLIF(BTRIM(${bannersTable.imagePath}), '') IS NOT NULL`,
    sql`NULLIF(BTRIM(${bannersTable.ctaLabel}), '') IS NOT NULL AND NULLIF(BTRIM(${bannersTable.targetUrl}), '') IS NOT NULL`,
  ),
  or(isNull(bannersTable.startsAt), lte(bannersTable.startsAt, new Date())),
  or(isNull(bannersTable.endsAt), gt(bannersTable.endsAt, new Date())),
);

const formatBanner = (banner: typeof bannersTable.$inferSelect) => ({
  ...banner,
  imageUrl: banner.imagePath ? bannerImageUrlForClient(banner.id) : null,
});

const ownerListingWhere = (sellerId: number) => and(
  eq(listingsTable.sellerId, sellerId),
  eq(listingsTable.status, "active"),
);

const normalizeTransactionReference = (value: string): string =>
  value.normalize("NFKC").trim().toLocaleLowerCase().replace(/[\s\-_.\/]/g, "");

const paymentReferencePattern = /^[\p{L}\p{N}][\p{L}\p{N}\s\-_.\/]{2,119}$/u;

const fingerprintForPaymentProof = async (
  objectPath: string,
): Promise<string | null> => {
  const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
  const [metadata] = await objectFile.getMetadata();
  return typeof metadata.md5Hash === "string" && metadata.md5Hash
    ? `md5:${metadata.md5Hash}`
    : null;
};

const getRows = async (where?: ReturnType<typeof and>) => {
  return db
    .select({ listing: listingsTable, category: categoriesTable, subcategory: subcategoriesTable, seller: usersTable })
    .from(listingsTable)
    .innerJoin(categoriesTable, eq(listingsTable.categoryId, categoriesTable.id))
    .leftJoin(subcategoriesTable, eq(listingsTable.subcategoryId, subcategoriesTable.id))
    .innerJoin(usersTable, eq(listingsTable.sellerId, usersTable.id))
    .where(where);
};

const getSavedIds = async (listingIds: number[], userId?: number) => {
  if (listingIds.length === 0 || !userId) return new Set<number>();
  const saved = await db
    .select({ listingId: savedListingsTable.listingId })
    .from(savedListingsTable)
    .where(and(eq(savedListingsTable.userId, userId), or(...listingIds.map((id) => eq(savedListingsTable.listingId, id)))));
  return new Set(saved.map((item) => item.listingId));
};

const getCategoryCatalog = async (activeOnly = true, includeE2E = false) => {
  const categories = activeOnly
    ? await db.select().from(categoriesTable).where(eq(categoriesTable.active, true)).orderBy(asc(categoriesTable.sortOrder), asc(categoriesTable.id))
    : await db.select().from(categoriesTable).orderBy(asc(categoriesTable.sortOrder), asc(categoriesTable.id));
  const subcategories = activeOnly
    ? await db.select().from(subcategoriesTable).where(eq(subcategoriesTable.active, true)).orderBy(asc(subcategoriesTable.sortOrder), asc(subcategoriesTable.id))
    : await db.select().from(subcategoriesTable).orderBy(asc(subcategoriesTable.sortOrder), asc(subcategoriesTable.id));
  const counts = await db
    .select({ categoryId: listingsTable.categoryId, total: count(listingsTable.id) })
    .from(listingsTable)
    .where(includeE2E ? activeListingWhere() : publicActiveListingWhere())
    .groupBy(listingsTable.categoryId);
  const countByCategory = new Map(counts.map((item) => [item.categoryId, Number(item.total)]));
  return categories.map((category) => ({
    ...category,
    count: countByCategory.get(category.id) ?? 0,
    subcategories: subcategories.filter((subcategory) => subcategory.categoryId === category.id),
  }));
};

router.get("/banners", async (_req, res): Promise<void> => {
  const banners = await db.select().from(bannersTable)
    .where(activeBannerWhere())
    .orderBy(asc(bannersTable.sortOrder), desc(bannersTable.createdAt));
  res.json(banners.map(formatBanner));
});

router.get("/banners/:id/image", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(404).json({ error: "Banner image not found" });
    return;
  }
  const [banner] = await db.select({ imagePath: bannersTable.imagePath })
    .from(bannersTable)
    .where(and(activeBannerWhere(), eq(bannersTable.id, id)))
    .limit(1);
  if (!banner) {
    res.status(404).json({ error: "Banner image not found" });
    return;
  }
  if (!banner.imagePath) {
    res.status(404).json({ error: "Banner image not found" });
    return;
  }
  try {
    const objectFile = await objectStorageService.getObjectEntityFile(banner.imagePath);
    const response = await objectStorageService.downloadObject(objectFile);
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    if (response.body) {
      Readable.fromWeb(response.body as ReadableStream<Uint8Array>).pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "Banner image not found" });
      return;
    }
    req.log.error({ err: error }, "Failed to serve banner image");
    res.status(503).json({ error: "Banner image storage is unavailable" });
  }
});

router.get("/categories", async (_req, res): Promise<void> => {
  await ensureSeed();
  res.json(ListCategoriesResponse.parse(await getCategoryCatalog()));
});

router.get("/categories/:slug/subcategories", async (req, res): Promise<void> => {
  await ensureSeed();
  const parsed = ListSubcategoriesParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [category] = await db.select({ id: categoriesTable.id }).from(categoriesTable).where(eq(categoriesTable.slug, parsed.data.slug));
  if (!category) {
    res.status(404).json({ error: "Category not found" });
    return;
  }
  const rows = await db.select().from(subcategoriesTable).where(and(eq(subcategoriesTable.categoryId, category.id), eq(subcategoriesTable.active, true))).orderBy(asc(subcategoriesTable.sortOrder));
  res.json(ListSubcategoriesResponse.parse(rows));
});

router.get("/admin/categories", async (_req, res): Promise<void> => {
  await ensureSeed();
  res.json(ListAdminCategoriesResponse.parse(await getCategoryCatalog(false, true)));
});

router.post("/admin/categories", async (req, res): Promise<void> => {
  await ensureSeed();
  const parsed = CreateCategoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [category] = await db.insert(categoriesTable).values(parsed.data).returning();
  const result = (await getCategoryCatalog(false, true)).find((item) => item.id === category.id);
  res.status(201).json(CreateCategoryResponse.parse(result));
});

router.patch("/admin/categories/:id", async (req, res): Promise<void> => {
  await ensureSeed();
  const params = UpdateCategoryParams.safeParse(req.params);
  const parsed = UpdateCategoryBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: "Invalid category payload" });
    return;
  }
  const [category] = await db.update(categoriesTable).set(parsed.data).where(eq(categoriesTable.id, params.data.id)).returning();
  if (!category) {
    res.status(404).json({ error: "Category not found" });
    return;
  }
  const result = (await getCategoryCatalog(false, true)).find((item) => item.id === category.id);
  res.json(UpdateCategoryResponse.parse(result));
});

router.delete("/admin/categories/:id", async (req, res): Promise<void> => {
  await ensureSeed();
  const params = DeleteCategoryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [category] = await db.update(categoriesTable).set({ active: false }).where(eq(categoriesTable.id, params.data.id)).returning();
  if (!category) {
    res.status(404).json({ error: "Category not found" });
    return;
  }
  res.sendStatus(204);
});

router.post("/admin/categories/:id/subcategories", async (req, res): Promise<void> => {
  await ensureSeed();
  const params = CreateSubcategoryParams.safeParse(req.params);
  const parsed = CreateSubcategoryBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: "Invalid subcategory payload" });
    return;
  }
  const [subcategory] = await db.insert(subcategoriesTable).values({ ...parsed.data, categoryId: params.data.id }).returning();
  res.status(201).json(CreateSubcategoryResponse.parse(subcategory));
});

router.patch("/admin/subcategories/:id", async (req, res): Promise<void> => {
  await ensureSeed();
  const params = UpdateSubcategoryParams.safeParse(req.params);
  const parsed = UpdateSubcategoryBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: "Invalid subcategory payload" });
    return;
  }
  const [subcategory] = await db.update(subcategoriesTable).set(parsed.data).where(eq(subcategoriesTable.id, params.data.id)).returning();
  if (!subcategory) {
    res.status(404).json({ error: "Subcategory not found" });
    return;
  }
  res.json(UpdateSubcategoryResponse.parse(subcategory));
});

router.delete("/admin/subcategories/:id", async (req, res): Promise<void> => {
  await ensureSeed();
  const params = DeleteSubcategoryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [subcategory] = await db.update(subcategoriesTable).set({ active: false }).where(eq(subcategoriesTable.id, params.data.id)).returning();
  if (!subcategory) {
    res.status(404).json({ error: "Subcategory not found" });
    return;
  }
  res.sendStatus(204);
});

router.get("/locations", async (_req, res): Promise<void> => {
  await ensureSeed();
  const locations = await db
    .select({ name: listingsTable.location, listingCount: count(listingsTable.id) })
    .from(listingsTable)
    .where(publicActiveListingWhere())
    .groupBy(listingsTable.location)
    .orderBy(desc(count(listingsTable.id)));
  res.json(ListLocationsResponse.parse(locations.map((item, index) => ({
    id: index + 1,
    name: item.name,
    country: "موريتانيا",
    listingCount: Number(item.listingCount),
  }))));
});

router.get("/market-pulse", async (req, res): Promise<void> => {
  await ensureSeed();
  const { userId } = getAuth(req);
  const candidateActor = await marketplaceUserForRequest(req);
  const actor = userId && candidateActor && await hasCurrentLegalConsentForClerkUser(userId)
    ? candidateActor
    : null;
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const activeWhere = publicActiveListingWhere();
  const availableWhere = activeWhere;
  const [availableResult, newResult, soldResult, topCategoryResult, recentRows] = await Promise.all([
    db.select({ total: count(listingsTable.id) }).from(listingsTable).where(availableWhere),
    db.select({ total: count(listingsTable.id) }).from(listingsTable).where(and(activeWhere, gte(listingsTable.createdAt, weekAgo))),
    db.select({ total: count(listingsTable.id) }).from(listingsTable).where(and(activeWhere, eq(listingsTable.saleStatus, "sold"), gte(listingsTable.soldAt, weekAgo))),
    db.select({
      name: categoriesTable.name,
      nameFr: categoriesTable.nameFr,
      nameEn: categoriesTable.nameEn,
      slug: categoriesTable.slug,
      count: count(listingsTable.id),
    })
      .from(categoriesTable)
      .innerJoin(listingsTable, and(
        eq(categoriesTable.id, listingsTable.categoryId),
        availableWhere,
      ))
      .groupBy(categoriesTable.id)
      .orderBy(desc(count(listingsTable.id)), asc(categoriesTable.sortOrder))
      .limit(1),
    db.select({ listing: listingsTable, category: categoriesTable, subcategory: subcategoriesTable, seller: usersTable })
      .from(listingsTable)
      .innerJoin(categoriesTable, eq(listingsTable.categoryId, categoriesTable.id))
      .leftJoin(subcategoriesTable, eq(listingsTable.subcategoryId, subcategoriesTable.id))
      .innerJoin(usersTable, eq(listingsTable.sellerId, usersTable.id))
      .where(activeWhere)
      .orderBy(desc(listingsTable.createdAt))
      .limit(4),
  ]);
  const savedIds = await getSavedIds(recentRows.map((row) => row.listing.id), actor?.id);
  const [topCategory] = topCategoryResult;
  res.json(GetMarketPulseResponse.parse({
    availableCount: Number(availableResult[0]?.total ?? 0),
    newThisWeekCount: Number(newResult[0]?.total ?? 0),
    soldThisWeekCount: Number(soldResult[0]?.total ?? 0),
    topCategory: topCategory
      ? { ...topCategory, count: Number(topCategory.count) }
      : null,
    recentListings: recentRows.map((row) => formatListing({
      ...row,
      isSaved: savedIds.has(row.listing.id),
    })),
  }));
});

router.get("/listings", async (req, res): Promise<void> => {
  try {
    await ensureSeed();
    const { userId } = getAuth(req);
    const candidateActor = await marketplaceUserForRequest(req);
    const actor = userId && candidateActor && await hasCurrentLegalConsentForClerkUser(userId)
      ? candidateActor
      : null;
    const featuredQuery = req.query.featured;
    const normalizedQuery =
      featuredQuery === "true" || featuredQuery === "false"
        ? { ...req.query, featured: featuredQuery === "true" }
        : req.query;
    const parsed = ListListingsQueryParams.safeParse(normalizedQuery);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const params = parsed.data;
    const activeWhere = publicActiveListingWhere();
    const clauses: SQL[] = activeWhere ? [activeWhere] : [];
    if (params.q) {
      const search = or(ilike(listingsTable.title, `%${params.q}%`), ilike(listingsTable.description, `%${params.q}%`));
      if (search) clauses.push(search);
    }
    if (params.category) clauses.push(eq(categoriesTable.slug, params.category));
    if (params.subcategory) clauses.push(eq(subcategoriesTable.slug, params.subcategory));
    if (params.location) clauses.push(ilike(listingsTable.location, `%${params.location}%`));
    const attributeFilter = (key: string, value: string) => sql`${listingsTable.attributes}->>${key} ILIKE ${`%${value}%`}`;
    if (params.saleType) clauses.push(attributeFilter("saleType", params.saleType));
    if (params.reference) clauses.push(attributeFilter("reference", params.reference));
    if (params.brand) clauses.push(attributeFilter("brand", params.brand));
    if (params.productType) clauses.push(attributeFilter("productType", params.productType));
    if (params.minPrice != null) clauses.push(gte(listingsTable.price, String(params.minPrice)));
    if (params.maxPrice != null) clauses.push(lte(listingsTable.price, String(params.maxPrice)));
    if (params.condition) clauses.push(eq(listingsTable.condition, params.condition));
    if (params.manufacturer) clauses.push(ilike(listingsTable.manufacturer, `%${params.manufacturer}%`));
    if (params.model) clauses.push(ilike(listingsTable.model, `%${params.model}%`));
    if (params.year) clauses.push(eq(listingsTable.year, params.year));
     if (params.featured != null) {
       clauses.push(eq(listingsTable.featured, params.featured));
       if (params.featured) {
         clauses.push(sql`EXISTS (
           SELECT 1
           FROM ${paymentsTable}
           INNER JOIN ${paymentPackagesTable}
             ON ${paymentsTable.packageId} = ${paymentPackagesTable.id}
           WHERE ${paymentsTable.listingId} = ${listingsTable.id}
             AND ${paymentsTable.status} = 'confirmed'
             AND ${paymentPackagesTable.featured} = true
         )`);
       }
     }
    const where = clauses.length ? and(...clauses) : undefined;
     const orderBy = params.sort === "price_asc"
       ? [asc(listingsTable.price), asc(listingsTable.id)]
       : params.sort === "price_desc"
         ? [desc(listingsTable.price), desc(listingsTable.id)]
         : [desc(listingsTable.createdAt), desc(listingsTable.id)];
    const [rows, [{ total }]] = await Promise.all([
      db.select({ listing: listingsTable, category: categoriesTable, subcategory: subcategoriesTable, seller: usersTable })
        .from(listingsTable)
        .innerJoin(categoriesTable, eq(listingsTable.categoryId, categoriesTable.id))
        .leftJoin(subcategoriesTable, eq(listingsTable.subcategoryId, subcategoriesTable.id))
        .innerJoin(usersTable, eq(listingsTable.sellerId, usersTable.id))
        .where(where)
         .orderBy(...orderBy)
        .limit(params.limit)
        .offset((params.page - 1) * params.limit),
      db.select({ total: count(listingsTable.id) })
        .from(listingsTable)
        .innerJoin(categoriesTable, eq(listingsTable.categoryId, categoriesTable.id))
        .leftJoin(subcategoriesTable, eq(listingsTable.subcategoryId, subcategoriesTable.id))
        .where(where),
    ]);
    const savedIds = await getSavedIds(rows.map((row) => row.listing.id), actor?.id);
    const response = {
      items: rows.map((row) => formatListing({ ...row, isSaved: savedIds.has(row.listing.id) })),
      total: Number(total),
      page: params.page,
      limit: params.limit,
    };
    res.json(ListListingsResponse.parse(response));
  } catch (error) {
    req.log.error({ err: error }, "Failed to load marketplace listings");
    const details = process.env.NODE_ENV === "development" && error instanceof Error
      ? error.message
      : undefined;
    res.status(500).json({
      error: "Failed to load marketplace listings",
      ...(details ? { detail: details } : {}),
    });
  }
});

router.get("/listings/:id", async (req, res): Promise<void> => {
  await ensureSeed();
  const parsed = GetListingParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const publicVisibility = and(
    eq(listingsTable.id, parsed.data.id),
    publicActiveListingWhere(),
  );
  const [publicRow] = await getRows(publicVisibility);
  if (publicRow) {
    const { userId } = getAuth(req);
    const candidateActor = await marketplaceUserForRequest(req);
    const actor = userId && candidateActor && await hasCurrentLegalConsentForClerkUser(userId)
      ? candidateActor
      : null;
    const savedIds = await getSavedIds([publicRow.listing.id], actor?.id);
    res.json(GetListingResponse.parse(formatListing({
      ...publicRow,
      includeContactPhone: true,
      isSaved: savedIds.has(publicRow.listing.id),
    })));
    return;
  }

  const { userId } = getAuth(req);
  if (!userId) {
    res.status(404).json({ error: "Listing not found" });
    return;
  }
  if (!(await requireCurrentLegalConsent(userId, res))) return;

  const actor = await marketplaceUserForRequest(req);
  if (!actor) {
    res.status(404).json({ error: "Listing not found" });
    return;
  }
  const [row] = await getRows(and(
    eq(listingsTable.id, parsed.data.id),
    eq(listingsTable.sellerId, actor.id),
    eq(listingsTable.status, "rejected"),
  ));
  if (!row) {
    res.status(404).json({ error: "Listing not found" });
    return;
  }
  const savedIds = await getSavedIds([row.listing.id], actor.id);
  res.json(GetListingResponse.parse(formatListing({
    ...row,
    includeContactPhone: true,
    isSaved: savedIds.has(row.listing.id),
  })));
});

const findCategory = async (slug: string) => {
  const [category] = await db.select().from(categoriesTable).where(eq(categoriesTable.slug, slug));
  return category;
};

const findSubcategory = async (slug: string | null | undefined, categoryId: number) => {
  if (!slug) return null;
  const [subcategory] = await db.select().from(subcategoriesTable).where(and(eq(subcategoriesTable.slug, slug), eq(subcategoriesTable.categoryId, categoryId)));
  return subcategory ?? null;
};

router.post("/listing-image/uploads/request-url", async (req, res): Promise<void> => {
  const actor = await authenticatedMarketplaceUser(req, res);
  if (!actor) return;
  if (!validateListingImageMetadata(req.body)) {
    res.status(400).json({ error: "Invalid listing image file" });
    return;
  }

  try {
    const owner = getAuth(req).userId!;
    const uploadURL = await objectStorageService.getObjectEntityUploadURL("listing-image-inputs", listingImageInputId(owner, randomUUID()));
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);
    if (!isOwnedListingImageInput(objectPath, owner)) {
      res.status(500).json({ error: "Invalid listing image object path" });
      return;
    }
    res.json({ uploadURL, objectPath });
  } catch (error) {
    req.log.error({ err: error }, "Failed to create listing image upload URL");
    res.status(503).json({ error: "Listing image storage is unavailable" });
  }
});

router.post("/listing-image/uploads/process", async (req, res): Promise<void> => {
  const actor = await authenticatedMarketplaceUser(req, res);
  if (!actor) return;
  const owner = getAuth(req).userId!;
  const parsed = ProcessListingImageUploadBody.safeParse(req.body);
  const objectPath = parsed.success ? parsed.data.objectPath : undefined;
  if (!isOwnedListingImageInput(objectPath, owner)) {
    res.status(400).json({ error: "Invalid image upload or upload belongs to another user" });
    return;
  }
  try {
    const result = await withListingImageProcessing(async () => {
      const inputFile = await objectStorageService.getObjectEntityFile(objectPath);
      const [metadata] = await inputFile.getMetadata();
      const size = Number(metadata.size);
      if (!Number.isFinite(size) || size <= 0 || size > listingImageMaxBytes || !listingImageContentTypes.has(metadata.contentType ?? "")) {
        throw new InvalidListingImageError("Only JPG, PNG and WebP images up to 8 MB are accepted");
      }
      const input = await readListingImageInput(inputFile.createReadStream());
      const processed = await processListingImage(input, metadata.contentType!);
      const id = randomUUID();
      const fullPath = `/objects/listing-images/${id}`;
      const thumbnailPath = `/objects/listing-images-thumbnails/${id}`;
      const createdArtifacts: string[] = [];
      try {
        // New objects only, with create-if-absent preconditions. Remove the
        // source only after both processed copies have been stored.
        await objectStorageService.createPrivateImage(thumbnailPath, processed.thumbnail.data, owner, { listingImageVersion: "1" });
        createdArtifacts.push(thumbnailPath);
        await objectStorageService.createPrivateImage(fullPath, processed.full.data, owner, { listingImageVersion: "1" });
        createdArtifacts.push(fullPath);
        await objectStorageService.markObjectPrivate(objectPath, owner);
        await objectStorageService.deleteObjectIfExists(objectPath);
      } catch (error) {
        await Promise.all(createdArtifacts.map(async (path) => {
          try {
            await objectStorageService.deleteObjectIfExists(path);
          } catch (cleanupError) {
            req.log.error({ err: cleanupError }, "Failed to remove an incomplete listing image derivative");
          }
        }));
        throw error;
      }
      return {
        objectPath: fullPath,
        originalBytes: processed.originalBytes,
        fullBytes: processed.full.info.size,
        thumbnailBytes: processed.thumbnail.info.size,
        width: processed.full.info.width,
        height: processed.full.info.height,
      };
    });
    res.json(ProcessListingImageUploadResponse.parse(result));
  } catch (error) {
    if (error instanceof InvalidListingImageError) {
      res.status(400).json({ error: error.message });
    } else if (error instanceof ObjectNotFoundError) {
      res.status(400).json({ error: "Image upload has not completed" });
    } else {
      req.log.error({ err: error }, "Failed to process listing image");
      res.status(503).json({ error: "Listing image processing is unavailable" });
    }
  }
});

router.get("/listing-images/:id", async (req, res): Promise<void> => {
  const objectId = typeof req.params.id === "string" ? req.params.id : "";
  if (!/^[0-9a-f-]{36}$/i.test(objectId)) {
    res.status(404).json({ error: "Listing image not found" });
    return;
  }
  const actor = await marketplaceUserForRequest(req);
  const accessPolicy = getListingImageAccessPolicy(actor);
  if (accessPolicy.kind === "deny") {
    res.status(403).json({ error: "Account is suspended" });
    return;
  }
  const objectPath = `/objects/listing-images/${objectId}`;
  const imageMatch = or(
    eq(listingsTable.imageUrl, objectPath),
    sql`${listingsTable.images} @> ARRAY[${objectPath}]::text[]`,
  );
  const [publicListing] = await db
    .select({ id: listingsTable.id })
    .from(listingsTable)
    .where(and(imageMatch, activeListingWhere()))
    .limit(1);
  let listing = publicListing;
  if (!listing) {
    if (!listingImageRequiresConsent(accessPolicy, false)) {
      res.status(404).json({ error: "Listing image not found" });
      return;
    }
    const { userId } = getAuth(req);
    if (!(await requireCurrentLegalConsent(userId, res))) return;
    const privateListingVisibility = accessPolicy.kind === "owner-or-active"
      ? eq(listingsTable.sellerId, accessPolicy.sellerId)
      : undefined;
    const [privateListing] = await db
      .select({ id: listingsTable.id })
      .from(listingsTable)
      .where(and(imageMatch, privateListingVisibility))
      .limit(1);
    listing = privateListing;
  }
  if (!listing) {
    res.status(404).json({ error: "Listing image not found" });
    return;
  }

  try {
    let objectFile = await objectStorageService.getObjectEntityFile(objectPath);
    const [metadata] = await objectFile.getMetadata();
    if (req.query.variant === "thumbnail" && metadata.metadata?.listingImageVersion === "1") {
      try {
        objectFile = await objectStorageService.getObjectEntityFile(`/objects/listing-images-thumbnails/${objectId}`);
      } catch (error) {
        if (!(error instanceof ObjectNotFoundError)) throw error;
        // A missing thumbnail must not break the listing's existing full image.
      }
    }
    const response = await objectStorageService.downloadObject(objectFile);
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    if (response.body) {
      Readable.fromWeb(response.body as ReadableStream<Uint8Array>).pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "Listing image not found" });
      return;
    }
    req.log.error({ err: error }, "Failed to serve listing image");
    res.status(503).json({ error: "Listing image storage is unavailable" });
  }
});

router.post("/listings", async (req, res): Promise<void> => {
  await ensureSeed();
  const actor = await authenticatedMarketplaceUser(req, res);
  if (!actor) return;
  const parsed = CreateListingBody.strict().safeParse(req.body);
  if (parsed.success) {
    parsed.data.images = parsed.data.images?.map(canonicalListingImageReference);
    if (parsed.data.imageUrl) parsed.data.imageUrl = canonicalListingImageReference(parsed.data.imageUrl);
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const normalizedPhones = normalizeListingPhones(parsed.data);
  if (!normalizedPhones.ok || !normalizedPhones.phones.contactPhone) {
    res.status(400).json({ error: "Phone numbers must contain eight digits and start with 2, 3, or 4" });
    return;
  }
  const category = await findCategory(parsed.data.category);
  if (!category) {
    res.status(400).json({ error: "Category not found" });
    return;
  }
  const subcategory = await findSubcategory(parsed.data.subcategory, category.id);
  if (parsed.data.subcategory && !subcategory) {
    res.status(400).json({ error: "Subcategory not found for category" });
    return;
  }
  try {
    await secureListingImageObjects(parsed.data.images ?? (parsed.data.imageUrl ? [parsed.data.imageUrl] : []), getAuth(req).userId!);
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(400).json({ error: "One or more listing images were not uploaded" });
      return;
    }
    res.status(400).json({ error: error instanceof Error ? error.message : "Invalid listing images" });
    return;
  }
  const listing = await db.transaction(async (tx) => {
    const isRental = parsed.data.attributes?.saleType === "rent";
    if (isRental) {
      const [season] = await tx.select().from(rentalSeasonSettingsTable)
        .where(eq(rentalSeasonSettingsTable.id, 1))
        .for("update");
      if (!season?.isOpen) return null;
    }
    const [createdListing] = await tx.insert(listingsTable).values({
      ...listingFromBody({ ...parsed.data, ...normalizedPhones.phones }, actor.id, category.id, subcategory?.id ?? null),
      status: ENABLE_PAID_LISTINGS ? "pending_payment" : "pending_review",
      rentalStatus: "available",
    }).returning();

    const admins = await tx
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(or(eq(usersTable.role, "admin"), eq(usersTable.role, "moderator")));

    if (admins.length) {
      await tx.insert(notificationsTable).values(admins.map((admin) => ({
        userId: admin.id,
        listingId: createdListing.id,
        title: "إعلان جديد بانتظار المراجعة",
        body: ENABLE_PAID_LISTINGS
          ? `تم إنشاء الإعلان «${createdListing.title}» وهو بانتظار مراجعة الإدارة وتأكيد الدفع.`
          : `تم إنشاء الإعلان «${createdListing.title}» وهو بانتظار مراجعة الإدارة.`,
        type: "admin_new_listing",
        read: false,
      })));
    }

    return createdListing;
  });
  if (!listing) {
    res.status(409).json({ error: "Rental listings cannot be created while the season is closed" });
    return;
  }
  const [row] = await getRows(eq(listingsTable.id, listing.id));
  res.status(201).json(CreateListingResponse.parse(formatListing(row)));
});

router.patch("/listings/:id", async (req, res): Promise<void> => {
  await ensureSeed();
  const actor = await authenticatedMarketplaceUser(req, res);
  if (!actor) return;
  const params = UpdateListingParams.safeParse(req.params);
  const parsed = UpdateListingBody.strict().safeParse(req.body);
  if (parsed.success && parsed.data.images) {
    // Client display URLs must remain canonical stored references when old and new photos are mixed.
    parsed.data.images = parsed.data.images.map(canonicalListingImageReference);
  }
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [existingListing] = await db
    .select({
      saleStatus: listingsTable.saleStatus,
      rentalStatus: listingsTable.rentalStatus,
      contactPhone: listingsTable.contactPhone,
      whatsappPhone: listingsTable.whatsappPhone,
      createdAt: listingsTable.createdAt,
      description: listingsTable.description,
      images: listingsTable.images,
      imageUrl: listingsTable.imageUrl,
    })
    .from(listingsTable)
    .where(and(eq(listingsTable.id, params.data.id), eq(listingsTable.sellerId, actor.id)));
  if (!existingListing) {
    res.status(404).json({ error: "Listing not found" });
    return;
  }
  if (existingListing.saleStatus === "sold" || existingListing.rentalStatus === "leased") {
    res.status(409).json({ error: "Sold or leased listings cannot be edited" });
    return;
  }
  const contentRequested = parsed.data.description !== undefined || parsed.data.images !== undefined;
  const contentRestriction = listingContentEditRestriction(parsed.data, existingListing.createdAt);
  if (contentRestriction) {
    res.status(contentRestriction.status).json(contentRestriction);
    return;
  }
  if (parsed.data.images !== undefined) {
    try {
      await secureListingImageObjects(parsed.data.images.filter((path) =>
        !existingListing.images?.includes(path) && path !== existingListing.imageUrl), getAuth(req).userId!);
    } catch {
      res.status(400).json({ error: "One or more listing images were not uploaded or are unavailable" });
      return;
    }
  }
  const normalizedPhones = normalizeListingPhones(parsed.data, existingListing);
  if (!normalizedPhones.ok) {
    res.status(400).json({ error: "Phone numbers must contain eight digits and start with 2, 3, or 4" });
    return;
  }
  const [listing] = await db.update(listingsTable)
    .set(publishedListingUpdateValues(parsed.data, normalizedPhones.phones))
    .where(and(eq(listingsTable.id, params.data.id), eq(listingsTable.sellerId, actor.id),
      ...(contentRequested ? [gt(listingsTable.createdAt, new Date(Date.now() - EDIT_WINDOW_MS))] : [])))
    .returning();
  if (!listing) {
    res.status(contentRequested ? 403 : 404).json(contentRequested
      ? LISTING_CONTENT_EDIT_CLOSED_ERROR
      : { error: "Listing not found" });
    return;
  }
  const [row] = await getRows(eq(listingsTable.id, listing.id));
  res.json(UpdateListingResponse.parse(formatListing({ ...row, includeContactPhone: true })));
});

router.post("/listings/:id/sold", async (req, res): Promise<void> => {
  await ensureSeed();
  const actor = await authenticatedMarketplaceUser(req, res);
  if (!actor) return;
  const parsed = GetListingParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const result = await db.transaction(async (tx) => {
    const [listing] = await tx
      .select()
      .from(listingsTable)
      .where(and(eq(listingsTable.id, parsed.data.id), eq(listingsTable.sellerId, actor.id)))
      .for("update");
    if (!listing) return { kind: "not_found" as const };
    if (listing.attributes?.saleType === "rent") return { kind: "rental" as const };
    if (listing.saleStatus === "sold") return { kind: "already_sold" as const };

    const soldAt = new Date();
    const [updated] = await tx
      .update(listingsTable)
      .set({ saleStatus: "sold", soldAt })
      .where(eq(listingsTable.id, listing.id))
      .returning();
    await tx.insert(listingSaleEventsTable).values({
      listingId: listing.id,
      sellerId: actor.id,
      soldAt,
    });
    return { kind: "updated" as const, listing: updated };
  });

  if (result.kind === "not_found") {
    res.status(404).json({ error: "Listing not found" });
    return;
  }
  if (result.kind === "already_sold") {
    res.status(409).json({ error: "Listing is already sold" });
    return;
  }
  if (result.kind === "rental") {
    res.status(409).json({ error: "Rental listings must be marked as leased" });
    return;
  }
  const [row] = await getRows(eq(listingsTable.id, result.listing.id));
  res.json(GetListingResponse.parse(formatListing(row)));
});

router.post("/listings/:id/revert-sale", async (req, res): Promise<void> => {
  await ensureSeed();
  const actor = await authenticatedMarketplaceUser(req, res);
  if (!actor) return;
  const parsed = GetListingParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const result = await db.transaction(async (tx) => {
    const [listing] = await tx
      .select()
      .from(listingsTable)
      .where(and(eq(listingsTable.id, parsed.data.id), eq(listingsTable.sellerId, actor.id)))
      .for("update");
    if (!listing) return { kind: "not_found" as const };
    if (listing.attributes?.saleType === "rent") return { kind: "not_sold" as const };
    if (listing.saleStatus !== "sold" || !listing.soldAt) return { kind: "not_sold" as const };

    const now = new Date();
    if (!canRevertSale(listing.soldAt, now)) return { kind: "expired" as const };
    const [event] = await tx
      .select({ id: listingSaleEventsTable.id })
      .from(listingSaleEventsTable)
      .where(and(eq(listingSaleEventsTable.listingId, listing.id), isNull(listingSaleEventsTable.revertedAt)))
      .limit(1);
    if (!event) return { kind: "not_sold" as const };

    await tx
      .update(listingSaleEventsTable)
      .set({ revertedAt: now })
      .where(eq(listingSaleEventsTable.id, event.id));
    const [updated] = await tx
      .update(listingsTable)
      .set({ saleStatus: "available", soldAt: null })
      .where(eq(listingsTable.id, listing.id))
      .returning();
    return { kind: "updated" as const, listing: updated };
  });

  if (result.kind === "not_found") {
    res.status(404).json({ error: "Listing not found" });
    return;
  }
  if (result.kind === "expired") {
    res.status(409).json({ error: "The sale reversal window has expired" });
    return;
  }
  if (result.kind === "not_sold") {
    res.status(409).json({ error: "Listing is not currently sold" });
    return;
  }
  const [row] = await getRows(eq(listingsTable.id, result.listing.id));
  res.json(GetListingResponse.parse(formatListing(row)));
});

router.post("/listings/:id/lease", async (req, res): Promise<void> => {
  await ensureSeed();
  const actor = await authenticatedMarketplaceUser(req, res);
  if (!actor) return;
  const parsed = GetListingParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const result = await db.transaction(async (tx) => {
    const [season] = await tx.select().from(rentalSeasonSettingsTable)
      .where(eq(rentalSeasonSettingsTable.id, 1)).for("update");
    const [listing] = await tx.select().from(listingsTable)
      .where(and(eq(listingsTable.id, parsed.data.id), eq(listingsTable.sellerId, actor.id)))
      .for("update");
    if (!listing) return { kind: "not_found" as const };
    if (!season?.isOpen) return { kind: "season_closed" as const };
    if (listing.attributes?.saleType !== "rent" || listing.rentalSeasonArchivedAt
      || listing.rentalStatus !== "available" || listing.status !== "active") {
      return { kind: "conflict" as const };
    }
    const [updated] = await tx.update(listingsTable)
      .set({ rentalStatus: "leased", rentedAt: new Date() })
      .where(eq(listingsTable.id, listing.id))
      .returning();
    return { kind: "updated" as const, listing: updated };
  });
  if (result.kind === "not_found") {
    res.status(404).json({ error: "Listing not found" });
    return;
  }
  if (result.kind !== "updated") {
    res.status(409).json({ error: result.kind === "season_closed" ? "Rental season is closed" : "Listing cannot be marked as leased" });
    return;
  }
  const [row] = await getRows(eq(listingsTable.id, result.listing.id));
  res.json(GetListingResponse.parse(formatListing(row)));
});

router.post("/listings/:id/renew", async (req, res): Promise<void> => {
  await ensureSeed();
  const actor = await authenticatedMarketplaceUser(req, res);
  if (!actor) return;
  const parsed = GetListingParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const result = await db.transaction(async (tx) => {
    const [season] = await tx.select().from(rentalSeasonSettingsTable)
      .where(eq(rentalSeasonSettingsTable.id, 1)).for("update");
    const [listing] = await tx.select().from(listingsTable)
      .where(and(eq(listingsTable.id, parsed.data.id), eq(listingsTable.sellerId, actor.id)))
      .for("update");
    if (!listing) return { kind: "not_found" as const };
    if (!season?.isOpen) return { kind: "season_closed" as const };
    if (Number(season.renewalFee) > 0) return { kind: "fee_required" as const };
    if (listing.attributes?.saleType !== "rent" || !listing.rentalSeasonArchivedAt
      || listing.status !== "active") return { kind: "conflict" as const };
    const [updated] = await tx.update(listingsTable)
      .set({ rentalStatus: "available", rentalSeasonArchivedAt: null })
      .where(eq(listingsTable.id, listing.id))
      .returning();
    return { kind: "updated" as const, listing: updated };
  });
  if (result.kind === "not_found") {
    res.status(404).json({ error: "Listing not found" });
    return;
  }
  if (result.kind !== "updated") {
    const error = result.kind === "season_closed" ? "Rental season is closed"
      : result.kind === "fee_required" ? "A renewal payment is required"
        : "Listing cannot be renewed";
    res.status(409).json({ error });
    return;
  }
  const [row] = await getRows(eq(listingsTable.id, result.listing.id));
  res.json(GetListingResponse.parse(formatListing(row)));
});

router.get("/payment-options", async (req, res): Promise<void> => {
  await ensureSeed();
  const actor = await authenticatedMarketplaceUser(req, res);
  if (!actor) return;
  if (!ENABLE_PAID_LISTINGS) {
    res.json({ packages: [], methods: [] });
    return;
  }
  const [packages, methods] = await Promise.all([
    db.select().from(paymentPackagesTable).where(eq(paymentPackagesTable.active, true)).orderBy(asc(paymentPackagesTable.price)),
    db.select().from(paymentMethodsTable).where(eq(paymentMethodsTable.active, true)).orderBy(asc(paymentMethodsTable.createdAt)),
  ]);
  res.json({ packages, methods });
});

router.post("/payment-proof/uploads/request-url", async (req, res): Promise<void> => {
  const actor = await authenticatedMarketplaceUser(req, res);
  if (!actor) return;
  if (!ENABLE_PAID_LISTINGS) {
    res.status(410).json({ error: "Listing payments are temporarily disabled" });
    return;
  }
  if (!validatePaymentProofMetadata(req.body)) {
    res.status(400).json({ error: "Invalid payment proof file" });
    return;
  }
  const userId = getAuth(req).userId!;

  try {
    const id = randomUUID();
    const uploadId = createPaymentProofUploadId(userId, id);
    const uploadURL = await objectStorageService.getObjectEntityUploadURL(
      "uploads",
      uploadId,
    );
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);
    if (!isPaymentProofObjectPath(objectPath)) {
      res.status(500).json({ error: "Invalid private object path" });
      return;
    }
    res.json({ uploadURL, objectPath });
    cleanupAbandonedPaymentProofs(req.log);
  } catch (error) {
    req.log.error({ err: error }, "Failed to create payment proof upload URL");
    res.status(503).json({ error: "Payment proof storage is unavailable" });
  }
});

router.get("/payments/mine", async (req, res): Promise<void> => {
  const actor = await authenticatedMarketplaceUser(req, res);
  if (!actor) return;
  const rows = await db.select({
    payment: paymentsTable,
    listing: listingsTable,
    package: paymentPackagesTable,
    method: paymentMethodsTable,
  })
    .from(paymentsTable)
    .leftJoin(listingsTable, eq(paymentsTable.listingId, listingsTable.id))
    .leftJoin(paymentPackagesTable, eq(paymentsTable.packageId, paymentPackagesTable.id))
    .leftJoin(paymentMethodsTable, eq(paymentsTable.paymentMethodId, paymentMethodsTable.id))
    .where(eq(paymentsTable.userId, actor.id))
    .orderBy(desc(paymentsTable.createdAt));
  const items = await Promise.all(rows.map(async ({ payment, listing, package: pkg, method }) => ({
    ...payment,
    proofAvailable: await paymentProofIsAvailable(payment.proofImageUrl),
    listing,
    package: pkg,
    method,
  })));
  res.json({ items });
});

router.post("/payments", async (req, res): Promise<void> => {
  const actor = await authenticatedMarketplaceUser(req, res);
  if (!actor) return;
  if (!ENABLE_PAID_LISTINGS) {
    res.status(410).json({ error: "Listing payments are temporarily disabled" });
    return;
  }
  const listingId = parsePaymentId(req.body?.listingId);
  const packageId = parsePaymentId(req.body?.packageId);
  const paymentMethodId = parsePaymentId(req.body?.paymentMethodId);
  const transactionReference = typeof req.body?.transactionReference === "string" ? req.body.transactionReference.trim() : "";
  const accountHolderName = typeof req.body?.accountHolderName === "string" ? req.body.accountHolderName.trim() : "";
  const paymentDate = typeof req.body?.transactionDate === "string" ? new Date(req.body.transactionDate) : null;
  const proofObjectPath = validatePaymentProofObjectPath(req.body?.proofObjectPath);
  const transactionReferenceKey = transactionReference ? normalizeTransactionReference(transactionReference) : "";
  if (
    !listingId
    || !packageId
    || !paymentMethodId
    || !transactionReference
    || !paymentReferencePattern.test(transactionReference)
    || !transactionReferenceKey
    || accountHolderName.length < 2
    || accountHolderName.length > 160
    || !paymentDate
    || Number.isNaN(paymentDate.getTime())
    || !proofObjectPath
  ) {
    res.status(400).json({ error: "All payment confirmation fields are required" });
    return;
  }
  if (!isPaymentProofOwnedByUser(proofObjectPath, getAuth(req).userId!)) {
    res.status(403).json({ error: "Payment proof upload does not belong to this user" });
    return;
  }
  const [listing] = await db.select().from(listingsTable).where(and(eq(listingsTable.id, listingId), eq(listingsTable.sellerId, actor.id)));
  const [paymentPackage] = await db.select().from(paymentPackagesTable).where(and(eq(paymentPackagesTable.id, packageId), eq(paymentPackagesTable.active, true)));
  const [paymentMethod] = await db.select().from(paymentMethodsTable).where(and(eq(paymentMethodsTable.id, paymentMethodId), eq(paymentMethodsTable.active, true)));
  if (!listing || !paymentPackage || !paymentMethod) {
    res.status(404).json({ error: "Listing, package, or payment method not found" });
    return;
  }
  if (listing.saleStatus === "sold") {
    res.status(409).json({ error: "Sold listings are not available for sale" });
    return;
  }
  if (Number(req.body?.amount) !== Number(paymentPackage.price)) {
    res.status(400).json({ error: "Payment amount does not match the selected package" });
    return;
  }
  const [existingPending] = await db.select().from(paymentsTable).where(and(eq(paymentsTable.listingId, listingId), eq(paymentsTable.status, "pending")));
  if (existingPending) {
    res.status(409).json({ error: "A payment confirmation is already pending" });
    return;
  }
  try {
    await objectStorageService.sanitizePaymentProofObject(proofObjectPath, getAuth(req).userId!);
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(400).json({ error: "Payment proof upload was not completed" });
      return;
    }
    if (error instanceof InvalidPaymentProofImageError) {
      res.status(400).json({ error: "Payment proof must be a valid, supported image" });
      return;
    }
    req.log.error({ err: error }, "Failed to secure payment proof");
    res.status(503).json({ error: "Payment proof storage is unavailable" });
    return;
  }
  let proofFingerprint: string | null = null;
  try {
    proofFingerprint = await fingerprintForPaymentProof(proofObjectPath);
  } catch (error) {
    req.log.error({ err: error }, "Failed to fingerprint payment proof");
    res.status(503).json({ error: "Payment proof storage is unavailable" });
    return;
  }
  const [duplicateReference] = await db.select({ id: paymentsTable.id })
    .from(paymentsTable)
    .where(and(
      eq(paymentsTable.transactionReferenceKey, transactionReferenceKey),
      ne(paymentsTable.status, "rejected"),
    ))
    .limit(1);
  if (duplicateReference) {
    res.status(409).json({ error: "This transaction reference has already been submitted" });
    return;
  }
  if (proofFingerprint) {
    const [duplicateProof] = await db.select({ id: paymentsTable.id })
      .from(paymentsTable)
      .where(and(
        eq(paymentsTable.proofFingerprint, proofFingerprint),
        eq(paymentsTable.status, "confirmed"),
      ))
      .limit(1);
    if (duplicateProof) {
      res.status(409).json({ error: "This payment proof has already been confirmed" });
      return;
    }
  }
  let payment;
  try {
    payment = await db.transaction(async (tx) => {
      // Serialize payment submissions for the same listing. The unique partial
      // index is the final database guard; this lock gives the user a useful
      // conflict response instead of a low-level constraint error.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${listingId})`);
      const [pendingPayment] = await tx.select({ id: paymentsTable.id })
        .from(paymentsTable)
        .where(and(eq(paymentsTable.listingId, listingId), eq(paymentsTable.status, "pending")))
        .limit(1);
      if (pendingPayment) throw new Error("PAYMENT_ALREADY_PENDING");
      const [created] = await tx.insert(paymentsTable).values({
        userId: actor.id,
        listingId,
        packageId,
        paymentMethodId,
        amount: String(paymentPackage.price),
        currency: "MRU",
        listingRevision: listing.revision,
        transactionReference,
        transactionReferenceKey,
        transactionDate: paymentDate,
        accountHolderName,
        proofImageUrl: proofObjectPath,
        proofFingerprint,
        status: "pending",
      }).returning();
      await tx.update(listingsTable).set({ status: "pending_payment" }).where(eq(listingsTable.id, listingId));
      await tx.insert(notificationsTable).values({
        userId: actor.id,
        listingId,
        paymentId: created.id,
        title: "تم إرسال طلب الدفع",
        body: `تم استلام طلب تأكيد الدفع للإعلان «${listing.title}» وسيتم مراجعته من الإدارة.`,
        type: "payment_pending",
      });
      return created;
    });
  } catch (error) {
    if (error instanceof Error && error.message === "PAYMENT_ALREADY_PENDING") {
      res.status(409).json({ error: "A payment confirmation is already pending" });
      return;
    }
    throw error;
  }
  res.status(201).json(payment);
});

router.get("/notifications", async (req, res): Promise<void> => {
  const actor = await authenticatedMarketplaceUser(req, res);
  if (!actor) return;
  const [unread] = await db.select({ value: count() })
    .from(notificationsTable)
    .where(and(
      eq(notificationsTable.userId, actor.id),
      ne(notificationsTable.type, "admin_new_listing"),
      ne(notificationsTable.type, "message"),
      eq(notificationsTable.read, false),
    ));
  res.json({
    items: await db.select()
      .from(notificationsTable)
       .where(and(
         eq(notificationsTable.userId, actor.id),
         ne(notificationsTable.type, "admin_new_listing"),
         ne(notificationsTable.type, "message"),
       ))
      .orderBy(desc(notificationsTable.createdAt))
      .limit(50),
    unreadCount: Number(unread?.value ?? 0),
  });
});

router.patch("/notifications/:id/read", async (req, res): Promise<void> => {
  const actor = await authenticatedMarketplaceUser(req, res);
  if (!actor) return;
  const id = parsePaymentId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid notification id" });
    return;
  }
  const [notification] = await db.update(notificationsTable)
    .set({ read: true })
    .where(and(
      eq(notificationsTable.id, id),
      eq(notificationsTable.userId, actor.id),
      ne(notificationsTable.type, "admin_new_listing"),
      ne(notificationsTable.type, "message"),
    ))
    .returning();
  if (!notification) {
    res.status(404).json({ error: "Notification not found" });
    return;
  }
  res.json(notification);
});

router.get("/reports", async (req, res): Promise<void> => {
  const actor = await authenticatedMarketplaceUser(req, res);
  if (!actor) return;
  const reports = await db.select({
    report: reportsTable,
    listing: listingsTable,
  })
    .from(reportsTable)
    .leftJoin(listingsTable, eq(reportsTable.listingId, listingsTable.id))
    .where(eq(reportsTable.reporterId, actor.id))
    .orderBy(desc(reportsTable.createdAt))
    .limit(100);
  res.json({
    items: reports.map(({ report, listing }) => ({
      ...report,
      listing: listing ? { id: listing.id, title: listing.title } : null,
    })),
  });
});

router.post("/reports", async (req, res): Promise<void> => {
  const actor = await authenticatedMarketplaceUser(req, res);
  if (!actor) return;
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
  const details = typeof req.body?.details === "string" ? req.body.details.trim() : "";
  const listingId = parsePaymentId(req.body?.listingId);
  const reportedUserId = parsePaymentId(req.body?.reportedUserId);
  const contactRequested = req.body?.contactRequested === true;
  const allowedReasons = new Set(["spam", "inappropriate", "fraud", "misleading", "other"]);
  if (!allowedReasons.has(reason) || details.length < 10 || details.length > 5000 || (!listingId && !reportedUserId)) {
    res.status(400).json({ error: "A valid report reason, details, and listing or user are required" });
    return;
  }
  if (reportedUserId === actor.id) {
    res.status(400).json({ error: "You cannot report yourself" });
    return;
  }
  let listing: typeof listingsTable.$inferSelect | null = null;
  if (listingId) {
    [listing] = await db.select().from(listingsTable).where(eq(listingsTable.id, listingId)).limit(1);
    if (!listing) {
      res.status(404).json({ error: "Listing not found" });
      return;
    }
  }
  if (reportedUserId) {
    const [reportedUser] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, reportedUserId)).limit(1);
    if (!reportedUser) {
      res.status(404).json({ error: "User not found" });
      return;
    }
  }
  const report = await db.transaction(async (tx) => {
    const [created] = await tx.insert(reportsTable).values({
      reporterId: actor.id,
      listingId: listing?.id ?? null,
      reportedUserId: reportedUserId ?? listing?.sellerId ?? null,
      reason,
      details,
      contactRequested,
    }).returning();
    const admins = await tx.select({ id: usersTable.id })
      .from(usersTable)
      .where(or(eq(usersTable.role, "admin"), eq(usersTable.role, "moderator")));
    if (admins.length) {
      await tx.insert(notificationsTable).values(admins.map((admin) => ({
        userId: admin.id,
        reportId: created.id,
        listingId: created.listingId,
        title: "بلاغ جديد بانتظار المراجعة",
        body: listing ? `تم الإبلاغ عن الإعلان «${listing.title}».` : "تم استلام بلاغ جديد.",
        type: "admin_new_report",
        read: false,
      })));
    }
    return created;
  });
  res.status(201).json(report);
});

router.get("/reports/:id", async (req, res): Promise<void> => {
  const actor = await authenticatedMarketplaceUser(req, res);
  if (!actor) return;
  const reportId = parsePaymentId(req.params.id);
  if (!reportId) {
    res.status(400).json({ error: "Invalid report id" });
    return;
  }
  const [report] = await db.select({
    id: reportsTable.id,
    reason: reportsTable.reason,
    details: reportsTable.details,
    contactRequested: reportsTable.contactRequested,
    status: reportsTable.status,
    action: reportsTable.action,
    createdAt: reportsTable.createdAt,
    resolvedAt: reportsTable.resolvedAt,
  }).from(reportsTable).where(and(
    eq(reportsTable.id, reportId),
    eq(reportsTable.reporterId, actor.id),
  )).limit(1);
  if (!report) {
    res.status(404).json({ error: "Report not found" });
    return;
  }
  const replies = await db.select({
    id: notificationsTable.id,
    body: notificationsTable.body,
    createdAt: notificationsTable.createdAt,
  }).from(notificationsTable).where(and(
    eq(notificationsTable.userId, actor.id),
    eq(notificationsTable.reportId, report.id),
    eq(notificationsTable.type, "report_reply"),
  )).orderBy(asc(notificationsTable.createdAt));
  res.json({ ...report, replies });
});

router.patch("/reports/:id/read", async (req, res): Promise<void> => {
  const actor = await authenticatedMarketplaceUser(req, res);
  if (!actor) return;
  const reportId = parsePaymentId(req.params.id);
  if (!reportId) {
    res.status(400).json({ error: "Invalid report id" });
    return;
  }
  await db.update(notificationsTable)
    .set({ read: true })
    .where(and(
      eq(notificationsTable.userId, actor.id),
      eq(notificationsTable.reportId, reportId),
      eq(notificationsTable.type, "report_reply"),
    ));
  res.sendStatus(204);
});

router.delete("/listings/:id", async (req, res): Promise<void> => {
  await ensureSeed();
  const actor = await authenticatedMarketplaceUser(req, res);
  if (!actor) return;
  const parsed = DeleteListingParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    const deleted = await db.transaction(async (tx) => {
      const [listing] = await tx.select().from(listingsTable).where(and(
        eq(listingsTable.id, parsed.data.id),
        eq(listingsTable.sellerId, actor.id),
        eq(listingsTable.saleStatus, "available"),
      )).for("update");
      if (!listing) return false;

      await objectStorageService.deleteListingImageArtifacts([
        listing.imageUrl,
        ...listing.images,
      ]);
      await tx.delete(savedListingsTable).where(eq(savedListingsTable.listingId, listing.id));
      await tx.delete(messagesTable).where(eq(messagesTable.listingId, listing.id));
      await tx.delete(notificationsTable).where(eq(notificationsTable.listingId, listing.id));
      await tx.update(paymentsTable)
        .set({ listingId: null })
        .where(eq(paymentsTable.listingId, listing.id));
      await tx.update(reportsTable)
        .set({ listingId: null })
        .where(eq(reportsTable.listingId, listing.id));
      await tx.update(auditLogsTable)
        .set({ resourceId: null, details: {} })
        .where(and(
          eq(auditLogsTable.resourceType, "listing"),
          eq(auditLogsTable.resourceId, listing.id),
        ));
      await tx.delete(listingsTable).where(eq(listingsTable.id, listing.id));
      return true;
    });
    if (!deleted) {
      res.status(404).json({ error: "Listing not found" });
      return;
    }
    res.sendStatus(204);
  } catch (error) {
    req.log.error({ err: error }, "Failed to permanently delete seller listing");
    res.status(503).json({ error: "Listing could not be deleted" });
  }
});

router.post("/listings/:id/favorite", async (req, res): Promise<void> => {
  await ensureSeed();
  const actor = await authenticatedMarketplaceUser(req, res);
  if (!actor) return;
  const parsed = SetListingFavoriteParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const body = SetListingFavoriteBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  if (body.data.saved) {
    await db.insert(savedListingsTable)
      .values({ userId: actor.id, listingId: parsed.data.id })
      .onConflictDoNothing();
  } else {
    await db.delete(savedListingsTable).where(and(
      eq(savedListingsTable.userId, actor.id),
      eq(savedListingsTable.listingId, parsed.data.id),
    ));
  }
  res.json(SetListingFavoriteResponse.parse({ saved: body.data.saved }));
});

router.get("/saved-listings", async (req, res): Promise<void> => {
  await ensureSeed();
  const actor = await authenticatedMarketplaceUser(req, res);
  if (!actor) return;
  const rows = await db.select({ listing: listingsTable, category: categoriesTable, subcategory: subcategoriesTable, seller: usersTable })
    .from(savedListingsTable)
    .innerJoin(listingsTable, eq(savedListingsTable.listingId, listingsTable.id))
    .innerJoin(categoriesTable, eq(listingsTable.categoryId, categoriesTable.id))
    .leftJoin(subcategoriesTable, eq(listingsTable.subcategoryId, subcategoriesTable.id))
    .innerJoin(usersTable, eq(listingsTable.sellerId, usersTable.id))
    .where(and(eq(savedListingsTable.userId, actor.id), publicActiveListingWhere()))
    .orderBy(desc(savedListingsTable.createdAt));
  res.json(ListSavedListingsResponse.parse(rows.map((row) => formatListing({ ...row, isSaved: true }))));
});

router.use("/messages", (_req, res): void => {
  res.setHeader("Cache-Control", "no-store");
  res.status(410).json({ error: "Internal buyer-seller messaging is no longer available" });
});

router.get("/messages", async (req, res): Promise<void> => {
  await ensureSeed();
  const actor = await authenticatedMarketplaceUser(req, res);
  if (!actor) return;
  const rows = await db.select({ message: messagesTable, listing: listingsTable, sender: usersTable })
    .from(messagesTable)
    .innerJoin(listingsTable, eq(messagesTable.listingId, listingsTable.id))
    .innerJoin(usersTable, eq(messagesTable.senderId, usersTable.id))
    .where(or(eq(messagesTable.recipientId, actor.id), eq(messagesTable.senderId, actor.id)))
    .orderBy(desc(messagesTable.createdAt));
  const items = await Promise.all(rows.slice(0, 100).map(async (row) => {
    const isIncoming = row.message.recipientId === actor.id;
    const [counterparty] = await db.select({ name: usersTable.name })
      .from(usersTable)
      .where(eq(usersTable.id, isIncoming ? row.message.senderId : row.message.recipientId))
      .limit(1);
    return {
      id: row.message.id,
      listingId: row.message.listingId,
      listingTitle: row.listing.title,
      senderName: counterparty?.name ?? row.sender.name,
      preview: row.message.body,
      createdAt: row.message.createdAt,
      unread: isIncoming ? row.message.unread : false,
    };
  }));
  res.json(ListMessagesResponse.parse(items));
});

router.patch("/messages/:id/read", async (req, res): Promise<void> => {
  await ensureSeed();
  const actor = await authenticatedMarketplaceUser(req, res);
  if (!actor) return;
  const id = parsePaymentId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid message id" });
    return;
  }
  const [message] = await db.update(messagesTable)
    .set({ unread: false })
    .where(and(
      eq(messagesTable.id, id),
      eq(messagesTable.recipientId, actor.id),
    ))
    .returning({ id: messagesTable.id });
  if (!message) {
    res.status(404).json({ error: "Message not found" });
    return;
  }
  res.json(MarkMessageReadResponse.parse({ ok: true }));
});

router.post("/messages", async (req, res): Promise<void> => {
  await ensureSeed();
  const actor = await authenticatedMarketplaceUser(req, res);
  if (!actor) return;
  const parsed = SendMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [listing] = await db.select().from(listingsTable).where(eq(listingsTable.id, parsed.data.listingId));
  if (!listing) {
    res.status(404).json({ error: "Listing not found" });
    return;
  }
  if (listing.status !== "active") {
    res.status(404).json({ error: "Listing not found" });
    return;
  }
  if (listing.saleStatus !== "available") {
    res.status(409).json({ error: "Sold listings cannot receive messages" });
    return;
  }
  if (listing.sellerId === actor.id) {
    res.status(400).json({ error: "You cannot message yourself" });
    return;
  }
  const [message] = await db.insert(messagesTable).values({
    listingId: listing.id,
    senderId: actor.id,
    recipientId: listing.sellerId,
    body: parsed.data.body,
  }).returning();
  await db.insert(notificationsTable).values({
    userId: listing.sellerId,
    listingId: listing.id,
    title: "رسالة جديدة حول إعلانك",
    body: parsed.data.body,
    type: "message",
    read: false,
  });
  res.status(201).json(SendMessageResponse.parse({
    id: message.id,
    listingId: message.listingId,
    listingTitle: listing.title,
    senderName: actor.name,
    preview: message.body,
    createdAt: message.createdAt,
    unread: message.unread,
  }));
});

router.get("/support", async (req, res): Promise<void> => {
  const actor = await authenticatedMarketplaceUser(req, res);
  if (!actor) return;
  const [settings] = await db.select({
    phone: supportSettingsTable.phone,
    whatsappPhone: supportSettingsTable.whatsappPhone,
  }).from(supportSettingsTable).where(eq(supportSettingsTable.id, 1)).limit(1);
  res.json(GetSupportSettingsResponse.parse({
    phone: settings?.phone ?? "",
    whatsappPhone: settings?.whatsappPhone ?? "",
  }));
});

router.post("/support", async (req, res): Promise<void> => {
  const actor = await authenticatedMarketplaceUser(req, res);
  if (!actor) return;
  const parsed = SendSupportMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [report] = await db.insert(reportsTable).values({
    reporterId: actor.id,
    reason: "support",
    details: parsed.data.message.trim(),
    contactRequested: parsed.data.requestContact,
  }).returning({ id: reportsTable.id, createdAt: reportsTable.createdAt });
  const admins = await db.select({ id: usersTable.id })
    .from(usersTable)
    .where(or(eq(usersTable.role, "admin"), eq(usersTable.role, "moderator")));
  if (admins.length) {
    await db.insert(notificationsTable).values(admins.map((admin) => ({
      userId: admin.id,
      reportId: report.id,
      title: "طلب دعم جديد",
      body: "تم استلام طلب دعم جديد من مستخدم.",
      type: "admin_new_report",
      read: false,
    })));
  }
  res.status(201).json(SendSupportMessageResponse.parse(report));
});

const accountProfilePayload = (profile: typeof usersTable.$inferSelect) => ({
  id: profile.id,
  name: profile.name,
  verified: profile.verified,
  phone: profile.phoneVerifiedAt ? profile.phone : null,
  phoneVerified: Boolean(profile.phoneVerifiedAt && profile.phone),
});

router.get("/account/me", async (req, res): Promise<void> => {
  const profile = await authenticatedMarketplaceUser(req, res);
  if (!profile) return;

  res.json(GetMyAccountProfileResponse.parse(accountProfilePayload(profile)));
});

router.patch("/account/me", async (req, res): Promise<void> => {
  const profile = await authenticatedMarketplaceUser(req, res);
  if (!profile) return;

  const parsed = UpdateMyAccountProfileBody.strict().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const name = parsed.data.name.trim().replace(/\s+/g, " ");
  if (!name || name.length > 120) {
    res.status(400).json({ error: "Name must contain 1 to 120 characters." });
    return;
  }

  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] || "")
    .join("") || "م";
  const [updatedProfile] = await db.update(usersTable)
    .set({ name, initials })
    .where(eq(usersTable.id, profile.id))
    .returning();

  if (!updatedProfile) {
    res.status(404).json({ error: "Account not found." });
    return;
  }

  res.json(UpdateMyAccountProfileResponse.parse(accountProfilePayload(updatedProfile)));
});

router.delete("/account/me", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    const deleted = await deleteMarketplaceAccount(userId, {
      store: accountDeletionStore,
      deleteObject: (objectPath) => objectStorageService.deleteObjectIfExists(objectPath),
      deleteClerkUser: async (clerkUserId) => {
        try {
          await clerkClient.users.deleteUser(clerkUserId);
        } catch (error) {
          const status = error && typeof error === "object"
            ? (error as { status?: unknown; statusCode?: unknown }).status
              ?? (error as { statusCode?: unknown }).statusCode
            : undefined;
          if (status !== 404) throw error;
        }
      },
    });
    if (!deleted) {
      res.status(404).json({ error: "Account not found" });
      return;
    }
    res.sendStatus(204);
  } catch (error) {
    req.log.error({ err: error }, "Account deletion could not be completed");
    res.status(503).json({ error: "Account deletion could not be completed. Please retry." });
  }
});

router.post("/account/me/email/sync", async (req, res): Promise<void> => {
  const profile = await authenticatedMarketplaceUser(req, res);
  const { userId } = getAuth(req);
  if (!profile || !userId) return;

  try {
    const clerkUser = await clerkClient.users.getUser(userId);
    const primaryEmail = clerkUser.emailAddresses.find(
      (emailAddress) => emailAddress.id === clerkUser.primaryEmailAddressId,
    );
    const email = primaryEmail?.verification?.status === "verified"
      ? primaryEmail.emailAddress
      : null;

    await db.update(usersTable)
      .set({ email })
      .where(eq(usersTable.id, profile.id));
    res.json({ email });
  } catch (error) {
    req.log.error({ err: error, clerkUserId: userId }, "Could not sync the account email");
    res.status(503).json({ error: "Email status could not be synchronized" });
  }
});

router.get("/dashboard/summary", async (req, res): Promise<void> => {
  await ensureSeed();
  const actor = await authenticatedMarketplaceUser(req, res);
  if (!actor) return;
  const [[listingCount], [userCount], [savedCount], categories, recentRows, archivedRentalRows, seasonRows] = await Promise.all([
    db.select({ total: count() }).from(listingsTable).where(and(eq(listingsTable.sellerId, actor.id), activeListingWhere())),
    db.select({ total: count() }).from(usersTable).where(eq(usersTable.id, actor.id)),
    db.select({ total: count() }).from(savedListingsTable).where(eq(savedListingsTable.userId, actor.id)),
    db.select({ category: categoriesTable.name, count: count(listingsTable.id) })
      .from(categoriesTable)
      .leftJoin(listingsTable, and(eq(categoriesTable.id, listingsTable.categoryId), ownerListingWhere(actor.id), eq(listingsTable.saleStatus, "available")))
      .groupBy(categoriesTable.id)
      .orderBy(desc(count(listingsTable.id))),
    db.select({ listing: listingsTable, category: categoriesTable, subcategory: subcategoriesTable, seller: usersTable })
      .from(listingsTable)
      .innerJoin(categoriesTable, eq(listingsTable.categoryId, categoriesTable.id))
      .leftJoin(subcategoriesTable, eq(listingsTable.subcategoryId, subcategoriesTable.id))
      .innerJoin(usersTable, eq(listingsTable.sellerId, usersTable.id))
       .where(and(ownerListingWhere(actor.id), isNull(listingsTable.rentalSeasonArchivedAt)))
      .orderBy(desc(listingsTable.createdAt))
      .limit(5),
    db.select({ listing: listingsTable, category: categoriesTable, subcategory: subcategoriesTable, seller: usersTable })
      .from(listingsTable)
      .innerJoin(categoriesTable, eq(listingsTable.categoryId, categoriesTable.id))
      .leftJoin(subcategoriesTable, eq(listingsTable.subcategoryId, subcategoriesTable.id))
      .innerJoin(usersTable, eq(listingsTable.sellerId, usersTable.id))
      .where(and(
        eq(listingsTable.sellerId, actor.id),
        sql`${listingsTable.attributes}->>'saleType' = 'rent'`,
        isNotNull(listingsTable.rentalSeasonArchivedAt),
      ))
      .orderBy(desc(listingsTable.rentalSeasonArchivedAt)),
    db.select().from(rentalSeasonSettingsTable).where(eq(rentalSeasonSettingsTable.id, 1)).limit(1),
  ]);
  const season = seasonRows[0];
  if (!season) {
    res.status(503).json({ error: "Rental season settings are unavailable" });
    return;
  }
  const response = {
    listingCount: Number(listingCount.total),
    userCount: Number(userCount.total),
    messageCount: 0,
    savedCount: Number(savedCount.total),
    categoryCounts: categories.map((item) => ({ category: item.category, count: Number(item.count) })),
    recentListings: recentRows.map((row) => formatListing({ ...row, includeContactPhone: true })),
    archivedRentalListings: archivedRentalRows.map((row) => formatListing({ ...row, includeContactPhone: true })),
    rentalSeasonOpen: season.isOpen,
    renewalFee: Number(season.renewalFee),
  };
  res.json(GetDashboardSummaryResponse.parse(response));
});

router.get("/dashboard/active-listings", async (req, res): Promise<void> => {
  await ensureSeed();
  const actor = await authenticatedMarketplaceUser(req, res);
  if (!actor) return;
  const rows = await db
    .select({ listing: listingsTable, category: categoriesTable, subcategory: subcategoriesTable, seller: usersTable })
    .from(listingsTable)
    .innerJoin(categoriesTable, eq(listingsTable.categoryId, categoriesTable.id))
    .leftJoin(subcategoriesTable, eq(listingsTable.subcategoryId, subcategoriesTable.id))
    .innerJoin(usersTable, eq(listingsTable.sellerId, usersTable.id))
    .where(and(
      eq(listingsTable.sellerId, actor.id),
      or(
        activeListingWhere(),
        and(
          sql`${listingsTable.attributes}->>'saleType' = 'rent'`,
          isNotNull(listingsTable.rentalSeasonArchivedAt),
        ),
      ),
    ))
    .orderBy(desc(listingsTable.createdAt));
  res.json(ListSellerActiveListingsResponse.parse(
    rows.map((row) => formatListing({ ...row, includeContactPhone: true })),
  ));
});

export default router;