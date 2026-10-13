import { createInsertSchema } from "drizzle-zod";
import { pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const legalConsentsTable = pgTable("marketplace_legal_consents", {
  id: serial("id").primaryKey(),
  clerkUserId: text("clerk_user_id"),
  termsVersion: text("terms_version").notNull(),
  privacyVersion: text("privacy_version").notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }).notNull().defaultNow(),
  locale: text("locale"),
}, (table) => ({
  oneAcceptancePerPolicyPair: uniqueIndex("marketplace_legal_consents_user_versions_unique")
    .on(table.clerkUserId, table.termsVersion, table.privacyVersion),
}));

export const insertLegalConsentSchema = createInsertSchema(legalConsentsTable)
  .omit({ id: true, acceptedAt: true });
export type InsertLegalConsent = z.infer<typeof insertLegalConsentSchema>;
export type LegalConsent = typeof legalConsentsTable.$inferSelect;
