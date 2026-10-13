import {
  createHash,
  randomBytes,
  scrypt,
  timingSafeEqual,
  type ScryptOptions,
} from "node:crypto";
import { promisify } from "node:util";
import type { Request } from "express";

const scryptAsync = promisify(scrypt) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options?: ScryptOptions,
) => Promise<Buffer>;

const SCRYPT_N = 16_384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEY_LENGTH = 64;
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

export type AdminPasswordSetupStatus =
  | "configured"
  | "ready"
  | "missing-secret"
  | "invalid-secret";
type AttemptState = {
  failedAttempts: number;
  windowStartedAt: number;
  blockedUntil: number;
};

const loginAttempts = new Map<string, AttemptState>();

export function assertStrongAdminPassword(password: unknown): asserts password is string {
  if (
    typeof password !== "string"
    || password.length < 12
    || password.length > 128
    || !/[a-z]/.test(password)
    || !/[A-Z]/.test(password)
    || !/[0-9]/.test(password)
    || !/[^A-Za-z0-9]/.test(password)
  ) {
    throw new Error("Password must be 12-128 characters with upper, lower, number, and symbol");
  }
}

export function getAdminPasswordSetupStatus(password: unknown): Exclude<AdminPasswordSetupStatus, "configured"> {
  if (typeof password !== "string" || password.length === 0) return "missing-secret";

  try {
    assertStrongAdminPassword(password);
    return "ready";
  } catch {
    return "invalid-secret";
  }
}

export type AdminInitialPasswordStatus = "missing" | "invalid" | "available";

export function getAdminInitialPasswordStatus(): AdminInitialPasswordStatus {
  const initialPassword = process.env.ADMIN_INITIAL_PASSWORD;
  if (!initialPassword) return "missing";

  try {
    assertStrongAdminPassword(initialPassword);
    return "available";
  } catch {
    return "invalid";
  }
}

export async function hashAdminPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derivedKey = await scryptAsync(password, salt, SCRYPT_KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: 128 * 1024 * 1024,
  });
  return [
    "scrypt",
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString("base64url"),
    derivedKey.toString("base64url"),
  ].join("$");
}

export async function verifyAdminPassword(password: string, encodedHash: string): Promise<boolean> {
  const [algorithm, n, r, p, encodedSalt, encodedKey] = encodedHash.split("$");
  if (algorithm !== "scrypt" || !n || !r || !p || !encodedSalt || !encodedKey) return false;

  const expectedKey = Buffer.from(encodedKey, "base64url");
  if (expectedKey.length !== SCRYPT_KEY_LENGTH) return false;

  try {
    const actualKey = await scryptAsync(
      password,
      Buffer.from(encodedSalt, "base64url"),
      expectedKey.length,
      {
        N: Number(n),
        r: Number(r),
        p: Number(p),
        maxmem: 128 * 1024 * 1024,
      },
    );
    return timingSafeEqual(actualKey, expectedKey);
  } catch {
    return false;
  }
}

export function hashAdminSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createAdminSessionToken() {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  return {
    token,
    tokenHash: hashAdminSessionToken(token),
    expiresAt,
  };
}

export function adminSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_TTL_MS,
  };
}

export function getAdminSessionCookie(req: Request): string | null {
  const token = req.cookies?.admin_session;
  return typeof token === "string" && token.length > 0 ? token : null;
}

function attemptKey(req: Request, userId: string): string {
  return `${req.ip || "unknown"}:${userId}`;
}

export function checkAdminPasswordRateLimit(req: Request, userId: string) {
  const key = attemptKey(req, userId);
  const now = Date.now();
  const current = loginAttempts.get(key);
  if (!current) return { allowed: true, retryAfterSeconds: 0 };

  if (current.blockedUntil > now) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((current.blockedUntil - now) / 1000),
    };
  }

  if (now - current.windowStartedAt >= ATTEMPT_WINDOW_MS) {
    loginAttempts.delete(key);
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

export function recordAdminPasswordFailure(req: Request, userId: string) {
  const key = attemptKey(req, userId);
  const now = Date.now();
  const current = loginAttempts.get(key);
  const state = !current || now - current.windowStartedAt >= ATTEMPT_WINDOW_MS
    ? { failedAttempts: 0, windowStartedAt: now, blockedUntil: 0 }
    : current;

  state.failedAttempts += 1;
  if (state.failedAttempts >= MAX_FAILED_ATTEMPTS) {
    state.blockedUntil = now + LOCKOUT_MS;
  }
  loginAttempts.set(key, state);
}

export function clearAdminPasswordFailures(req: Request, userId: string) {
  loginAttempts.delete(attemptKey(req, userId));
}

export const adminPasswordPolicy = {
  minimumLength: 12,
  maximumLength: 128,
  sessionHours: SESSION_TTL_MS / (60 * 60 * 1000),
  maxFailedAttempts: MAX_FAILED_ATTEMPTS,
  lockoutMinutes: LOCKOUT_MS / (60 * 1000),
};
