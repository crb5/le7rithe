import {
  boolean,
  jsonb,
  integer,
  numeric,
  pgTable,
  serial,
  smallint,
  check,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("marketplace_users", {
  id: serial("id").primaryKey(),
  clerkUserId: text("clerk_user_id"),
  name: text("name").notNull(),
  email: text("email"),
  initials: text("initials").notNull(),
  phone: text("phone"),
  phoneVerifiedAt: timestamp("phone_verified_at", { withTimezone: true }),
  verified: boolean("verified").notNull().default(false),
  role: text("role").notNull().default("user"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  clerkUserIdUnique: uniqueIndex("marketplace_users_clerk_user_id_unique").on(table.clerkUserId),
  verifiedPhoneUnique: uniqueIndex("marketplace_users_verified_phone_unique")
    .on(table.phone)
    .where(sql`${table.phoneVerifiedAt} is not null`),
}));

export const adminCredentialsTable = pgTable("marketplace_admin_credentials", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }).unique(),
  passwordHash: text("password_hash").notNull(),
  passwordUpdatedAt: timestamp("password_updated_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const adminSessionsTable = pgTable("marketplace_admin_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

export const categoriesTable = pgTable("marketplace_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  nameFr: text("name_fr").notNull().default(""),
  nameEn: text("name_en").notNull().default(""),
  slug: text("slug").notNull().unique(),
  icon: text("icon").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
});

export const subcategoriesTable = pgTable("marketplace_subcategories", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id").notNull().references(() => categoriesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  nameFr: text("name_fr").notNull().default(""),
  nameEn: text("name_en").notNull().default(""),
  slug: text("slug").notNull().unique(),
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
});

export const listingsTable = pgTable("marketplace_listings", {
  id: serial("id").primaryKey(),
  sellerId: integer("seller_id").notNull().references(() => usersTable.id),
  title: text("title").notNull(),
  categoryId: integer("category_id").notNull().references(() => categoriesTable.id),
  subcategoryId: integer("subcategory_id").references(() => subcategoriesTable.id),
  price: numeric("price", { precision: 14, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("MRU"),
  location: text("location").notNull(),
  condition: text("condition").notNull(),
  year: integer("year"),
  manufacturer: text("manufacturer"),
  model: text("model"),
  hours: integer("hours"),
  area: numeric("area", { precision: 12, scale: 2 }),
  waterAvailable: boolean("water_available"),
  electricityAvailable: boolean("electricity_available"),
  ownershipType: text("ownership_type"),
  contactPhone: text("contact_phone"),
  whatsappPhone: text("whatsapp_phone"),
  attributes: jsonb("attributes").$type<Record<string, unknown>>().notNull().default({}),
  description: text("description").notNull(),
  imageUrl: text("image_url").notNull(),
  images: text("images").array().notNull().default([]),
  status: text("status").notNull().default("active"),
  saleStatus: text("sale_status").notNull().default("available"),
  soldAt: timestamp("sold_at", { withTimezone: true }),
  rentalStatus: text("rental_status").$type<"available" | "leased">().notNull().default("available"),
  rentalSeasonArchivedAt: timestamp("rental_season_archived_at", { withTimezone: true }),
  rentalAdminHiddenAt: timestamp("rental_admin_hidden_at", { withTimezone: true }),
  rentedAt: timestamp("rented_at", { withTimezone: true }),
  moderationReason: text("moderation_reason"),
  moderatedAt: timestamp("moderated_at", { withTimezone: true }),
  moderatedBy: integer("moderated_by"),
  featured: boolean("featured").notNull().default(false),
  pinned: boolean("pinned").notNull().default(false),
  revision: integer("revision").notNull().default(1),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  rentalStatusValid: check(
    "marketplace_listings_rental_status_check",
    sql`${table.rentalStatus} IN ('available', 'leased')`,
  ),
}));

export const rentalSeasonSettingsTable = pgTable("marketplace_rental_season_settings", {
  id: smallint("id").primaryKey().default(1),
  isOpen: boolean("is_open").notNull().default(true),
  seasonName: text("season_name"),
  renewalFee: numeric("renewal_fee", { precision: 14, scale: 2 }).notNull().default("0"),
  changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  singleton: check("marketplace_rental_season_settings_singleton", sql`${table.id} = 1`),
  nonNegativeFee: check("marketplace_rental_season_settings_fee_nonnegative", sql`${table.renewalFee} >= 0`),
}));

export const bannersTable = pgTable("marketplace_banners", {
  id: serial("id").primaryKey(),
  title: text("title"),
  subtitle: text("subtitle"),
  additionalText: text("additional_text"),
  imagePath: text("image_path"),
  imageAlt: text("image_alt"),
  ctaLabel: text("cta_label"),
  targetUrl: text("target_url"),
  active: boolean("active").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const listingSaleEventsTable = pgTable("marketplace_listing_sale_events", {
  id: serial("id").primaryKey(),
  listingId: integer("listing_id").notNull().references(() => listingsTable.id, { onDelete: "cascade" }),
  sellerId: integer("seller_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  soldAt: timestamp("sold_at", { withTimezone: true }).notNull().defaultNow(),
  revertedAt: timestamp("reverted_at", { withTimezone: true }),
}, (table) => ({
  oneOpenSalePerListing: uniqueIndex("marketplace_listing_sale_events_open_unique")
    .on(table.listingId)
    .where(sql`${table.revertedAt} IS NULL`),
  validRevertTime: check(
    "marketplace_listing_sale_events_reverted_after_sold",
    sql`${table.revertedAt} IS NULL OR ${table.revertedAt} >= ${table.soldAt}`,
  ),
}));

export const savedListingsTable = pgTable("marketplace_saved_listings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  listingId: integer("listing_id").notNull().references(() => listingsTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  oneSavePerUserListing: uniqueIndex("marketplace_saved_listings_user_listing_unique")
    .on(table.userId, table.listingId),
}));

export const messagesTable = pgTable("marketplace_messages", {
  id: serial("id").primaryKey(),
  listingId: integer("listing_id").notNull().references(() => listingsTable.id),
  senderId: integer("sender_id").notNull().references(() => usersTable.id),
  recipientId: integer("recipient_id").notNull().references(() => usersTable.id),
  body: text("body").notNull(),
  unread: boolean("unread").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const paymentPackagesTable = pgTable("marketplace_payment_packages", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  price: numeric("price", { precision: 14, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("MRU"),
  durationDays: integer("duration_days").notNull().default(30),
  listingType: text("listing_type").notNull().default("standard"),
  features: jsonb("features").$type<string[]>().notNull().default([]),
  featured: boolean("featured").notNull().default(false),
  pinned: boolean("pinned").notNull().default(false),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const paymentMethodsTable = pgTable("marketplace_payment_methods", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  accountNumber: text("account_number").notNull(),
  accountName: text("account_name").notNull(),
  instructions: text("instructions").notNull().default(""),
  currency: text("currency").notNull().default("MRU"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const paymentsTable = pgTable("marketplace_payments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  listingId: integer("listing_id").references(() => listingsTable.id, { onDelete: "set null" }),
  packageId: integer("package_id").references(() => paymentPackagesTable.id),
  paymentMethodId: integer("payment_method_id").references(() => paymentMethodsTable.id),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("MRU"),
  transactionReference: text("transaction_reference"),
  transactionReferenceKey: text("transaction_reference_key"),
  transactionDate: timestamp("transaction_date", { withTimezone: true }),
  accountHolderName: text("account_holder_name"),
  proofImageUrl: text("proof_image_url"),
  proofFingerprint: text("proof_fingerprint"),
  listingRevision: integer("listing_revision").notNull().default(1),
  status: text("status").notNull().default("pending"),
  rejectionReason: text("rejection_reason"),
  reviewedBy: integer("reviewed_by"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  onePendingPaymentPerListing: uniqueIndex("marketplace_payments_pending_listing_unique")
    .on(table.listingId)
    .where(sql`${table.status} = 'pending' AND ${table.listingId} IS NOT NULL`),
  onePaymentPerReferenceKey: uniqueIndex("marketplace_payments_reference_key_unique")
    .on(table.transactionReferenceKey)
    .where(sql`${table.transactionReferenceKey} IS NOT NULL AND ${table.status} <> 'rejected'`),
  oneConfirmedPaymentPerProof: uniqueIndex("marketplace_payments_confirmed_proof_unique")
    .on(table.proofFingerprint)
    .where(sql`${table.proofFingerprint} IS NOT NULL AND ${table.status} = 'confirmed'`),
}));

export const reportsTable = pgTable("marketplace_reports", {
  id: serial("id").primaryKey(),
  reporterId: integer("reporter_id").notNull().references(() => usersTable.id),
  listingId: integer("listing_id").references(() => listingsTable.id),
  reportedUserId: integer("reported_user_id").references(() => usersTable.id),
  reason: text("reason").notNull(),
  details: text("details").notNull().default(""),
  contactRequested: boolean("contact_requested").notNull().default(false),
  status: text("status").notNull().default("open"),
  action: text("action"),
  resolvedBy: integer("resolved_by"),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const supportSettingsTable = pgTable("marketplace_support_settings", {
  id: integer("id").primaryKey().default(1),
  phone: text("phone").notNull().default(""),
  whatsappPhone: text("whatsapp_phone").notNull().default(""),
  updatedBy: integer("updated_by").references(() => usersTable.id),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const auditLogsTable = pgTable("marketplace_audit_logs", {
  id: serial("id").primaryKey(),
  actorId: integer("actor_id"),
  actorClerkUserId: text("actor_clerk_user_id"),
  action: text("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: integer("resource_id"),
  details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const notificationsTable = pgTable("marketplace_notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  listingId: integer("listing_id").references(() => listingsTable.id),
  paymentId: integer("payment_id").references(() => paymentsTable.id),
  reportId: integer("report_id").references(() => reportsTable.id),
  title: text("title").notNull(),
  body: text("body").notNull(),
  type: text("type").notNull().default("system"),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export const insertCategorySchema = createInsertSchema(categoriesTable).omit({ id: true });
export const insertSubcategorySchema = createInsertSchema(subcategoriesTable).omit({ id: true });
export const insertListingSchema = createInsertSchema(listingsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertBannerSchema = createInsertSchema(bannersTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSavedListingSchema = createInsertSchema(savedListingsTable).omit({ id: true, createdAt: true });
export const insertMessageSchema = createInsertSchema(messagesTable).omit({ id: true, createdAt: true });
export const insertPaymentPackageSchema = createInsertSchema(paymentPackagesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPaymentMethodSchema = createInsertSchema(paymentMethodsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPaymentSchema = createInsertSchema(paymentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertReportSchema = createInsertSchema(reportsTable).omit({ id: true, createdAt: true });
export const insertAuditLogSchema = createInsertSchema(auditLogsTable).omit({ id: true, createdAt: true });

export type User = typeof usersTable.$inferSelect;
export type Category = typeof categoriesTable.$inferSelect;
export type Subcategory = typeof subcategoriesTable.$inferSelect;
export type Listing = typeof listingsTable.$inferSelect;
export type Banner = typeof bannersTable.$inferSelect;
export type SavedListing = typeof savedListingsTable.$inferSelect;
export type Message = typeof messagesTable.$inferSelect;
export type PaymentPackage = typeof paymentPackagesTable.$inferSelect;
export type PaymentMethod = typeof paymentMethodsTable.$inferSelect;
export type Payment = typeof paymentsTable.$inferSelect;
export type Report = typeof reportsTable.$inferSelect;
export type SupportSettings = typeof supportSettingsTable.$inferSelect;
export type AuditLog = typeof auditLogsTable.$inferSelect;
export type Notification = typeof notificationsTable.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type InsertSubcategory = z.infer<typeof insertSubcategorySchema>;
export type InsertListing = z.infer<typeof insertListingSchema>;
export type InsertBanner = z.infer<typeof insertBannerSchema>;
export type InsertSavedListing = z.infer<typeof insertSavedListingSchema>;
export type InsertMessage = z.infer<typeof insertMessageSchema>;