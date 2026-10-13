import { createInsertSchema } from "drizzle-zod";
import { index, integer, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const phoneVerificationSessionsTable = pgTable(
  "marketplace_phone_verification_sessions",
  {
    id: serial("id").primaryKey(),
    clerkUserId: text("clerk_user_id"),
    verificationId: text("verification_id").notNull(),
    phone: text("phone").notNull(),
    purpose: text("purpose").notNull().default("link"),
    status: text("status").notNull().default("pending"),
    failedAttempts: integer("failed_attempts").notNull().default(0),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => ({
    verificationIdUnique: uniqueIndex("marketplace_phone_verification_id_unique").on(table.verificationId),
    userSentAtIndex: index("marketplace_phone_verification_user_sent_at_idx").on(table.clerkUserId, table.sentAt),
  }),
);

export const insertPhoneVerificationSessionSchema = createInsertSchema(phoneVerificationSessionsTable)
  .omit({ id: true, sentAt: true, updatedAt: true });

export type InsertPhoneVerificationSession = z.infer<typeof insertPhoneVerificationSessionSchema>;
export type PhoneVerificationSession = typeof phoneVerificationSessionsTable.$inferSelect;
