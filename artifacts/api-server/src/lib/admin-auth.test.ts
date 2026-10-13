import assert from "node:assert/strict";
import test from "node:test";
import type { Request } from "express";
import {
  adminPasswordPolicy,
  adminSessionCookieOptions,
  assertStrongAdminPassword,
  checkAdminPasswordRateLimit,
  clearAdminPasswordFailures,
  createAdminSessionToken,
  getAdminPasswordSetupStatus,
  hashAdminPassword,
  hashAdminSessionToken,
  recordAdminPasswordFailure,
  verifyAdminPassword,
} from "./admin-auth";

function request(ip: string): Request {
  return { ip } as Request;
}

test("admin passwords are hashed and verified without storing the cleartext", async () => {
  const password = "Valid-Admin-Password9!";
  const encoded = await hashAdminPassword(password);

  assert.notEqual(encoded, password);
  assert.match(encoded, /^scrypt\$/);
  assert.equal(await verifyAdminPassword(password, encoded), true);
  assert.equal(await verifyAdminPassword("wrong-password", encoded), false);
});

test("admin password policy rejects weak passwords", () => {
  assertStrongAdminPassword("Valid-Admin-Password9!");
  assert.throws(() => assertStrongAdminPassword("short"));
  assert.throws(() => assertStrongAdminPassword("alllowercasepassword1!"));
  assert.throws(() => assertStrongAdminPassword("ALLUPPERCASEPASSWORD1!"));
  assert.throws(() => assertStrongAdminPassword("NoSymbolPassword9"));
  assert.equal(adminPasswordPolicy.minimumLength, 12);
  assert.equal(adminPasswordPolicy.maximumLength, 128);
});

test("admin password setup status distinguishes missing, invalid, and ready secrets", () => {
  assert.equal(getAdminPasswordSetupStatus(undefined), "missing-secret");
  assert.equal(getAdminPasswordSetupStatus("weak-password"), "invalid-secret");
  assert.equal(getAdminPasswordSetupStatus("Valid-Admin-Password9!"), "ready");
});

test("admin session tokens are random, hashed, and time-limited", () => {
  const session = createAdminSessionToken();

  assert.ok(session.token.length >= 32);
  assert.notEqual(session.tokenHash, session.token);
  assert.equal(session.tokenHash, hashAdminSessionToken(session.token));
  assert.ok(session.expiresAt.getTime() > Date.now());
  assert.equal(adminSessionCookieOptions().httpOnly, true);
  assert.equal(adminSessionCookieOptions().sameSite, "lax");
});

test("admin password failures lock out after the configured threshold and can be cleared", () => {
  const req = request(`admin-auth-test-${Date.now()}-${Math.random()}`);
  const userId = "admin-auth-test-user";

  assert.equal(checkAdminPasswordRateLimit(req, userId).allowed, true);
  for (let attempt = 0; attempt < adminPasswordPolicy.maxFailedAttempts; attempt += 1) {
    recordAdminPasswordFailure(req, userId);
  }
  const locked = checkAdminPasswordRateLimit(req, userId);
  assert.equal(locked.allowed, false);
  assert.ok(locked.retryAfterSeconds > 0);

  clearAdminPasswordFailures(req, userId);
  assert.equal(checkAdminPasswordRateLimit(req, userId).allowed, true);
});