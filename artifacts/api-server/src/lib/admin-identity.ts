export type ClerkIdentity = {
  id: string;
  primaryEmailAddressId: string | null;
  emailAddresses: ReadonlyArray<{
    id: string;
    emailAddress: string;
    verification: { status: string } | null;
  }>;
  firstName: string | null;
  lastName: string | null;
};

export function allowedAdminEmails(configuration: string | undefined): Set<string> {
  return new Set((configuration ?? "").split(",").map(email => email.trim().toLowerCase()).filter(Boolean));
}

/** Only server-fetched Clerk data is accepted; neither claims nor local roles grant access. */
export function verifiedAdminIdentity(
  user: ClerkIdentity,
  expectedUserId: string,
  configuration: string | undefined,
): { email: string; name: string } | null {
  if (user.id !== expectedUserId) return null;
  const primary = user.emailAddresses.find(email => email.id === user.primaryEmailAddressId);
  if (!primary || primary.verification?.status !== "verified") return null;
  const email = primary.emailAddress.trim().toLowerCase();
  if (!allowedAdminEmails(configuration).has(email)) return null;
  return {
    email,
    name: [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || "مشرف الإدارة",
  };
}
