import { and, eq, inArray, or, sql } from "drizzle-orm";
import {
  auditLogsTable,
  db,
  legalConsentsTable,
  listingsTable,
  messagesTable,
  notificationsTable,
  paymentsTable,
  phoneVerificationSessionsTable,
  reportsTable,
  savedListingsTable,
  supportSettingsTable,
  usersTable,
} from "@workspace/db";
import type { ObjectStorageService } from "./objectStorage";
import type { AccountDeletionStore } from "./privacy-deletion";

export function createMarketplaceAccountDeletionStore(
  objectStorage: ObjectStorageService,
): AccountDeletionStore {
  return {
    begin: async (oidcSubject) => {
      const account = await db.transaction(async (tx) => {
        const [user] = await tx.select({
          id: usersTable.id,
          status: usersTable.status,
        })
          .from(usersTable)
          .where(eq(usersTable.oidcSubject, oidcSubject))
          .for("update");

        if (!user) return { localUserId: null as number | null };
        if (user.status !== "pending_deletion") {
          await tx.update(usersTable)
            .set({ status: "pending_deletion" })
            .where(eq(usersTable.id, user.id));
        }
        return { localUserId: user.id };
      });

      const [ownedListings, ownedPayments] = account.localUserId === null
        ? [[], []]
        : await Promise.all([
            db.select({
              imageUrl: listingsTable.imageUrl,
              images: listingsTable.images,
            })
              .from(listingsTable)
              .where(eq(listingsTable.sellerId, account.localUserId)),
            db.select({ proofImageUrl: paymentsTable.proofImageUrl })
              .from(paymentsTable)
              .where(eq(paymentsTable.userId, account.localUserId)),
          ]);
      const knownPaths = [
        ...ownedListings.flatMap(({ imageUrl, images }) => [imageUrl, ...images]),
        ...ownedPayments.flatMap(({ proofImageUrl }) => proofImageUrl ? [proofImageUrl] : []),
      ];
      const personalObjectPaths = await objectStorage.listOwnedPersonalDataObjectPaths(
        oidcSubject,
        knownPaths,
      );

      return { oidcSubject, personalObjectPaths };
    },

    eraseMarketplaceData: async (oidcSubject) => {
      const knownPaths = await db.transaction(async (tx) => {
      const [user] = await tx.select({
        id: usersTable.id,
        status: usersTable.status,
      })
        .from(usersTable)
        .where(eq(usersTable.oidcSubject, oidcSubject))
        .for("update");
      if (user && user.status !== "pending_deletion") {
        throw new Error("Account deletion was not marked pending");
      }

      const [ownedListings, ownedPayments, ownedReports] = user
        ? await Promise.all([
            tx.select({
              id: listingsTable.id,
              imageUrl: listingsTable.imageUrl,
              images: listingsTable.images,
            })
              .from(listingsTable)
              .where(eq(listingsTable.sellerId, user.id)),
            tx.select({
              id: paymentsTable.id,
              proofImageUrl: paymentsTable.proofImageUrl,
            })
              .from(paymentsTable)
              .where(eq(paymentsTable.userId, user.id)),
            tx.select({ id: reportsTable.id })
              .from(reportsTable)
              .where(eq(reportsTable.reporterId, user.id)),
          ])
        : [[], [], []];

      const listingIds = ownedListings.map(({ id }) => id);
      const paymentIds = ownedPayments.map(({ id }) => id);
      const reportIds = ownedReports.map(({ id }) => id);
      const notificationConditions = [eq(notificationsTable.userId, user?.id ?? -1)];
      if (listingIds.length) notificationConditions.push(inArray(notificationsTable.listingId, listingIds));
      if (paymentIds.length) notificationConditions.push(inArray(notificationsTable.paymentId, paymentIds));
      if (reportIds.length) notificationConditions.push(inArray(notificationsTable.reportId, reportIds));
      await tx.delete(notificationsTable).where(or(...notificationConditions));

      const savedConditions = [eq(savedListingsTable.userId, user?.id ?? -1)];
      if (listingIds.length) savedConditions.push(inArray(savedListingsTable.listingId, listingIds));
      await tx.delete(savedListingsTable).where(or(...savedConditions));

      const messageConditions = [
        eq(messagesTable.senderId, user?.id ?? -1),
        eq(messagesTable.recipientId, user?.id ?? -1),
      ];
      if (listingIds.length) messageConditions.push(inArray(messagesTable.listingId, listingIds));
      await tx.delete(messagesTable).where(or(...messageConditions));

      if (user) {
        await tx.delete(reportsTable).where(eq(reportsTable.reporterId, user.id));
        await tx.update(reportsTable)
          .set({ reportedUserId: null, listingId: null })
          .where(or(
            eq(reportsTable.reportedUserId, user.id),
            ...(listingIds.length ? [inArray(reportsTable.listingId, listingIds)] : []),
          ));

        await tx.update(paymentsTable).set({
          userId: null,
          listingId: null,
          transactionReference: null,
          transactionReferenceKey: null,
          accountHolderName: null,
          proofImageUrl: null,
          proofFingerprint: null,
          rejectionReason: null,
          status: sql`CASE WHEN ${paymentsTable.status} = 'pending' THEN 'withdrawn' ELSE ${paymentsTable.status} END`,
        }).where(eq(paymentsTable.userId, user.id));

        if (listingIds.length) {
          await tx.update(paymentsTable)
            .set({ listingId: null })
            .where(inArray(paymentsTable.listingId, listingIds));
          await tx.update(reportsTable)
            .set({ listingId: null })
            .where(inArray(reportsTable.listingId, listingIds));
          await tx.update(auditLogsTable)
            .set({ resourceId: null, details: {} })
            .where(and(
              eq(auditLogsTable.resourceType, "listing"),
              inArray(auditLogsTable.resourceId, listingIds),
            ));
          await tx.delete(listingsTable).where(inArray(listingsTable.id, listingIds));
        }

        await tx.update(supportSettingsTable)
          .set({ updatedBy: null })
          .where(eq(supportSettingsTable.updatedBy, user.id));
        await tx.update(auditLogsTable)
          .set({ actorId: null, actorOidcSubject: null, details: {} })
          .where(or(
            eq(auditLogsTable.actorId, user.id),
            eq(auditLogsTable.actorOidcSubject, oidcSubject),
          ));
        await tx.update(usersTable).set({
          name: "Deleted account",
          initials: "DA",
          email: null,
          phone: null,
          phoneVerifiedAt: null,
          verified: false,
          role: "user",
          status: "pending_deletion",
          updatedAt: new Date(),
        }).where(eq(usersTable.id, user.id));
      }

      await tx.update(legalConsentsTable)
        .set({ oidcSubject: null, locale: null })
        .where(eq(legalConsentsTable.oidcSubject, oidcSubject));
      await tx.delete(phoneVerificationSessionsTable)
        .where(eq(phoneVerificationSessionsTable.oidcSubject, oidcSubject));

      return [
        ...ownedListings.flatMap(({ imageUrl, images }) => [imageUrl, ...images]),
        ...ownedPayments.flatMap(({ proofImageUrl }) => proofImageUrl ? [proofImageUrl] : []),
      ];
      });
      return objectStorage.listOwnedPersonalDataObjectPaths(oidcSubject, knownPaths);
    },

    finalize: async (oidcSubject) => {
      await db.delete(usersTable)
        .where(and(
          eq(usersTable.oidcSubject, oidcSubject),
          eq(usersTable.status, "pending_deletion"),
        ));
    },
  };
}
