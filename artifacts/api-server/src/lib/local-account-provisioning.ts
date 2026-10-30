import { allowedAdminEmails, verifiedAdminIdentity, type VerifiableIdentity } from "./admin-identity";

export type LocalAccountDraft = {
  oidcSubject: string;
  name: string;
  email: string | null;
  initials: string;
  role: "admin" | "user";
  status: "active";
};

export async function provisionLocalAccount<T extends { role: string; status: string }>(
  input: {
    oidcSubject: string;
    existing: T | null;
    fallbackName: string;
    fallbackEmail: string | null;
    allowedEmails: string | undefined;
  },
  store: {
    loadIdentity: () => VerifiableIdentity;
    reconnectAdministrator: (verifiedEmail: string) => Promise<T | null>;
    create: (account: LocalAccountDraft) => Promise<T>;
    promote: (account: T, email: string) => Promise<T>;
  },
): Promise<T> {
  // Suspension is never lifted by an allowlist. Existing administrator roles
  // need no provisioning; administrative access still revalidates its token.
  if (input.existing && (input.existing.status !== "active" || input.existing.role === "admin")) {
    return input.existing;
  }
  const administrator = allowedAdminEmails(input.allowedEmails).size > 0
    ? verifiedAdminIdentity(store.loadIdentity(), input.oidcSubject, input.allowedEmails)
    : null;
  if (input.existing) {
    return administrator ? store.promote(input.existing, administrator.email) : input.existing;
  }
  if (administrator) {
    const reconnected = await store.reconnectAdministrator(administrator.email);
    if (reconnected) return reconnected;
  }
  const name = administrator?.name ?? input.fallbackName;
  return store.create({
    oidcSubject: input.oidcSubject,
    name,
    email: administrator?.email ?? input.fallbackEmail,
    initials: name.trim().split(/\s+/).slice(0, 2).map(part => part[0] || "").join("") || "م",
    role: administrator ? "admin" : "user",
    status: "active",
  });
}
