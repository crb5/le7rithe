import assert from "node:assert/strict";
import test from "node:test";
import { allowedAdminEmails, verifiedAdminIdentity } from "./admin-identity";

const identity = (id = "user_old_app") => ({
  id,
  primaryEmailAddressId: "email_primary",
  emailAddresses: [{
    id: "email_primary",
    emailAddress: "Owner@example.test",
    verification: { status: "verified" },
  }],
  firstName: "Site",
  lastName: "Owner",
});
const configuration = " owner@example.test ";

test("server allowlist normalizes casing and whitespace", () => {
  assert.deepEqual([...allowedAdminEmails(" OWNER@example.test, ,another@example.test ")],
    ["owner@example.test", "another@example.test"]);
});

test("verified allowed email authorizes both old and replacement Clerk IDs", () => {
  for (const id of ["user_old_app", "user_new_app"]) {
    assert.deepEqual(verifiedAdminIdentity(identity(id), id, configuration),
      { email: "owner@example.test", name: "Site Owner" });
  }
});

test("missing configuration fails closed", () => {
  assert.equal(verifiedAdminIdentity(identity(), "user_old_app", undefined), null);
});

test("unverified or other primary email cannot grant administration", () => {
  const unverified = identity();
  unverified.emailAddresses[0].verification.status = "unverified";
  assert.equal(verifiedAdminIdentity(unverified, unverified.id, configuration), null);
  const other = identity();
  other.emailAddresses[0].emailAddress = "other@example.test";
  assert.equal(verifiedAdminIdentity(other, other.id, configuration), null);
});

test("an allowed secondary email does not authorize a different primary email", () => {
  const user = identity();
  user.primaryEmailAddressId = "email_other";
  user.emailAddresses.push({
    id: "email_other", emailAddress: "other@example.test", verification: { status: "verified" },
  });
  assert.equal(verifiedAdminIdentity(user, user.id, configuration), null);
});

test("metadata, an old Clerk ID, or a mismatched fetched identity cannot grant access", () => {
  const user = { ...identity(), publicMetadata: { role: "admin" } };
  assert.equal(verifiedAdminIdentity(user, user.id, "other@example.test"), null);
  assert.equal(verifiedAdminIdentity(user, "user_someone_else", configuration), null);
});
