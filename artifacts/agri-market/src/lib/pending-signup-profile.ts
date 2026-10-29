const KEY = 'le7rithe:pending-signup-profile:v1';
const lifetimeMs = 30 * 60_000;

/**
 * Phone (and name) collected on the sign-up form but not sent to Authentik —
 * stashed across the OIDC redirect round-trip so it can be saved once the
 * app has a real authenticated session. See PendingSignupProfileSync in
 * app-router.tsx for where it's consumed.
 */
export type PendingSignupProfile = { name: string; phone: string };

export function savePendingSignupProfile(profile: PendingSignupProfile): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ ...profile, createdAt: Date.now() }));
  } catch {
    // Best-effort; worst case the post-login save step is skipped.
  }
}

/** Reads and clears in one step, so a retry/refresh can't apply it twice. */
export function takePendingSignupProfile(): PendingSignupProfile | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw);
    if (
      typeof draft.name !== 'string' || typeof draft.phone !== 'string' ||
      typeof draft.createdAt !== 'number' || Date.now() - draft.createdAt > lifetimeMs
    ) return null;
    return { name: draft.name, phone: draft.phone };
  } catch {
    return null;
  }
}
