import assert from "node:assert/strict";
import test from "node:test";
import { allowedAdminEmails, verifiedAdminIdentity, type VerifiableIdentity } from "./admin-identity";

const identity = (id = "user_old_app"): VerifiableIdentity => ({
  sub: id,
  email: "Owner@example.test",
  emailVerified: true,
  name: "Site Owner",
});
const configuration = " owner@example.test ";

test("server allowlist normalizes casing and whitespace", () => {
  assert.deepEqual([...allowedAdminEmails(" OWNER@example.test, ,another@example.test ")],
    ["owner@example.test", "another@example.test"]);
});

test("verified allowed email authorizes both old and replacement subject IDs", () => {
  for (const id of ["user_old_app", "user_new_app"]) {
    assert.deepEqual(verifiedAdminIdentity(identity(id), id, configuration),
      { email: "owner@example.test", name: "Site Owner" });
  }
});

test("missing configuration fails closed", () => {
  assert.equal(verifiedAdminIdentity(identity(), "user_old_app", undefined), null);
});

test("unverified or other email cannot grant administration", () => {
  const unverified = { ...identity(), emailVerified: false };
  assert.equal(verifiedAdminIdentity(unverified, unverified.sub, configuration), null);
  const other = { ...identity(), email: "other@example.test" };
  assert.equal(verifiedAdminIdentity(other, other.sub, configuration), null);
});

test("a missing email claim cannot grant administration", () => {
  const user = { ...identity(), email: null };
  assert.equal(verifiedAdminIdentity(user, user.sub, configuration), null);
});

test("a mismatched subject or a non-allowlisted email cannot grant access", () => {
  const user = identity();
  assert.equal(verifiedAdminIdentity(user, user.sub, "other@example.test"), null);
  assert.equal(verifiedAdminIdentity(user, "user_someone_else", configuration), null);
});
