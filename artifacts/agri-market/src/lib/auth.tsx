import type { ReactNode } from 'react';
import {
  AuthProvider as OidcAuthProvider,
  useAuth as useOidcAuth,
  type AuthProviderProps,
} from 'react-oidc-context';
import { WebStorageStateStore } from 'oidc-client-ts';

/**
 * Authentication shim over `react-oidc-context` (Authentik OIDC).
 *
 * Replaces the former Clerk integration. It exposes Clerk-shaped hooks
 * (`useAuth`, `useUser`, `useClerk`, `SignedIn`, `SignedOut`, `Show`) so the
 * many identity-consumer components only had to change their import, mirroring
 * the backend's drop-in `getAuth`. Sign-in/up is a redirect to the identity
 * provider; profile data is read from the verified token claims.
 */

const REDIRECT_KEY = 'postLoginRedirect';

const redirectUri =
  import.meta.env.VITE_OIDC_REDIRECT_URI ||
  `${window.location.origin}/auth/callback`;

export const oidcConfig: AuthProviderProps = {
  authority: import.meta.env.VITE_OIDC_ISSUER ?? '',
  client_id: import.meta.env.VITE_OIDC_CLIENT_ID ?? '',
  redirect_uri: redirectUri,
  post_logout_redirect_uri: window.location.origin,
  scope: 'openid profile email',
  userStore: new WebStorageStateStore({ store: window.localStorage }),
  onSigninCallback: () => {
    let target = '/';
    try {
      target = sessionStorage.getItem(REDIRECT_KEY) || '/';
      sessionStorage.removeItem(REDIRECT_KEY);
    } catch {
      target = '/';
    }
    window.history.replaceState({}, document.title, target);
  },
};

export function AuthProvider({ children }: { children: ReactNode }) {
  return <OidcAuthProvider {...oidcConfig}>{children}</OidcAuthProvider>;
}

type ShimEmail = { emailAddress: string };
export type ShimUser = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  imageUrl: string | undefined;
  primaryEmailAddress: ShimEmail | null;
  primaryPhoneNumber: { phoneNumber: string } | null;
  unsafeMetadata: Record<string, unknown>;
  publicMetadata: Record<string, unknown>;
  /** Profile is managed in the identity provider; this is a no-op locally. */
  update: (data?: unknown) => Promise<void>;
};

function toShimUser(oidc: ReturnType<typeof useOidcAuth>): ShimUser | null {
  const p = oidc.user?.profile;
  if (!oidc.isAuthenticated || !p) return null;
  const given = typeof p.given_name === 'string' ? p.given_name : null;
  const family = typeof p.family_name === 'string' ? p.family_name : null;
  const name =
    typeof p.name === 'string' && p.name.trim()
      ? p.name
      : [given, family].filter(Boolean).join(' ') || null;
  return {
    id: String(p.sub),
    firstName: given,
    lastName: family,
    fullName: name,
    imageUrl: typeof p.picture === 'string' ? p.picture : undefined,
    primaryEmailAddress: typeof p.email === 'string' ? { emailAddress: p.email } : null,
    primaryPhoneNumber: typeof p.phone_number === 'string' ? { phoneNumber: p.phone_number } : null,
    unsafeMetadata: {},
    publicMetadata: {},
    update: async () => {},
  };
}

async function signOutTo(
  oidc: ReturnType<typeof useOidcAuth>,
  opts?: { redirectUrl?: string },
): Promise<void> {
  try {
    await oidc.removeUser();
  } finally {
    window.location.href = opts?.redirectUrl ?? '/';
  }
}

export function useAuth() {
  const a = useOidcAuth();
  return {
    isLoaded: !a.isLoading,
    isSignedIn: a.isAuthenticated,
    userId: a.isAuthenticated ? (a.user?.profile.sub ? String(a.user.profile.sub) : null) : null,
    getToken: async () => a.user?.access_token ?? null,
    signIn: () => a.signinRedirect(),
    signOut: (opts?: { redirectUrl?: string }) => signOutTo(a, opts),
  };
}

export function useUser() {
  const a = useOidcAuth();
  return { isLoaded: !a.isLoading, isSignedIn: a.isAuthenticated, user: toShimUser(a) };
}

export function useClerk() {
  const a = useOidcAuth();
  return {
    signOut: (opts?: { redirectUrl?: string }) => signOutTo(a, opts),
    openSignIn: () => a.signinRedirect(),
  };
}

/** Starts a redirect to the identity provider, remembering where to return. */
export function useSignInRedirect() {
  const a = useOidcAuth();
  return (returnTo?: string) => {
    try {
      if (returnTo) sessionStorage.setItem(REDIRECT_KEY, returnTo);
    } catch {
      // Best-effort; the IdP still returns to the default route.
    }
    return a.signinRedirect();
  };
}

export function SignedIn({ children }: { children: ReactNode }) {
  return useOidcAuth().isAuthenticated ? <>{children}</> : null;
}

export function SignedOut({ children }: { children: ReactNode }) {
  return useOidcAuth().isAuthenticated ? null : <>{children}</>;
}

export function Show({
  when,
  children,
}: {
  when: 'signed-in' | 'signed-out';
  children: ReactNode;
}) {
  const authed = useOidcAuth().isAuthenticated;
  if (when === 'signed-in') return authed ? <>{children}</> : null;
  return authed ? null : <>{children}</>;
}
