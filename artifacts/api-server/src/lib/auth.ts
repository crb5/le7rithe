import type { Request, Response, NextFunction } from "express";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

/**
 * OIDC bearer-token authentication.
 *
 * Replaces the former Clerk integration. The frontend obtains an access token
 * from the self-hosted identity provider (Authentik) via the Authorization
 * Code + PKCE flow and sends it as `Authorization: Bearer <token>`. This
 * module verifies that token against the provider's JWKS and exposes the same
 * `getAuth(req)` shape the route handlers already rely on (`userId` and
 * `sessionClaims`), so call sites did not have to change.
 */

const issuerBase = process.env.OIDC_ISSUER?.replace(/\/$/, "");
// Accept the issuer both with and without a trailing slash — Authentik's `iss`
// ends with "/" while operators often configure it without one.
const issuerCandidates = issuerBase ? [`${issuerBase}/`, issuerBase] : [];
// Audience is enforced only when explicitly configured; issuer + signature are
// always verified. (Authentik's access-token `aud` differs across versions.)
const audience = process.env.OIDC_AUDIENCE;

let remoteJwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function jwks(): ReturnType<typeof createRemoteJWKSet> {
  if (!remoteJwks) {
    const uri = process.env.OIDC_JWKS_URI || (issuerBase ? `${issuerBase}/jwks/` : "");
    if (!uri) {
      throw new Error(
        "OIDC_JWKS_URI or OIDC_ISSUER must be set to verify access tokens.",
      );
    }
    remoteJwks = createRemoteJWKSet(new URL(uri));
  }
  return remoteJwks;
}

export type AuthInfo = {
  userId: string | null;
  /** Verified token claims. Named `sessionClaims` for parity with the former Clerk shape. */
  sessionClaims?: JWTPayload;
  claims?: JWTPayload;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthInfo;
    }
  }
}

/**
 * Verifies the bearer token if present and attaches `req.auth`. Missing or
 * invalid tokens resolve to an anonymous request (`userId: null`) rather than
 * an error, so public marketplace reads continue to work for visitors; each
 * protected handler already rejects when `userId` is absent.
 */
export async function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.headers.authorization;
  const token =
    header && header.startsWith("Bearer ") ? header.slice(7).trim() : null;
  if (!token) {
    req.auth = { userId: null };
    next();
    return;
  }
  try {
    const { payload } = await jwtVerify(token, jwks(), {
      ...(issuerCandidates.length ? { issuer: issuerCandidates } : {}),
      ...(audience ? { audience } : {}),
    });
    req.auth = {
      userId: typeof payload.sub === "string" ? payload.sub : null,
      sessionClaims: payload,
      claims: payload,
    };
  } catch {
    req.auth = { userId: null };
  }
  next();
}

/** Drop-in replacement for the former `getAuth` from `@clerk/express`. */
export function getAuth(req: Request): AuthInfo {
  return req.auth ?? { userId: null };
}

export type OidcIdentity = {
  sub: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
};

/** Builds a normalized identity from verified token claims. */
export function identityFromClaims(
  userId: string,
  claims: JWTPayload | undefined,
): OidcIdentity {
  const c = (claims ?? {}) as Record<string, unknown>;
  const name =
    typeof c.name === "string" && c.name.trim()
      ? c.name
      : [c.given_name, c.family_name]
          .filter((part): part is string => typeof part === "string" && part.length > 0)
          .join(" ")
          .trim() || null;
  return {
    sub: userId,
    email: typeof c.email === "string" ? c.email : null,
    emailVerified: c.email_verified === true,
    name,
  };
}
