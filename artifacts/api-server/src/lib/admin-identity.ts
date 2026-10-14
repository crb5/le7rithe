/**
 * Normalized, provider-verified identity used to decide administrator access.
 * Populated from the OIDC access-token claims (see `identityFromClaims` in
 * `auth.ts`). The token signature is verified before these claims are trusted.
 */
export type VerifiableIdentity = {
  sub: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
};

export function allowedAdminEmails(configuration: string | undefined): Set<string> {
  return new Set((configuration ?? "").split(",").map(email => email.trim().toLowerCase()).filter(Boolean));
}

/**
 * Only a provider-verified, allowlisted email grants administrator identity;
 * neither local roles nor unverified claims are accepted.
 */
export function verifiedAdminIdentity(
  identity: VerifiableIdentity,
  expectedUserId: string,
  configuration: string | undefined,
): { email: string; name: string } | null {
  if (identity.sub !== expectedUserId) return null;
  if (!identity.email || !identity.emailVerified) return null;
  const email = identity.email.trim().toLowerCase();
  if (!allowedAdminEmails(configuration).has(email)) return null;
  return {
    email,
    name: identity.name?.trim() || "مشرف الإدارة",
  };
}
