import assert from "node:assert/strict";
import { test } from "node:test";
import {
  maxPhoneFailedAttemptsPerHour,
  PhoneAuthError,
  phoneChallengeAction,
  phoneFailedAttemptsExceeded,
  resolvePhoneAuthUser,
  validatePhoneSignupProfile,
} from "./phone-auth-user";

const phone = "+22236123456";
const identity = (id = "phone-user") => ({
  id, phoneNumbers: [{ phoneNumber: phone }], firstName: "Cheikhou",
  publicMetadata: { role: "user" },
});
type User = ReturnType<typeof identity>;
const signup = (firstName = "Cheikhou") => ({
  signup: true, firstName, lastName: "Test", password: "Test-only-password-42!",
});
const dependencies = (users: User[] = [], profiles: Array<{ clerkUserId: string | null; status: string }> = []) => {
  const creates: Array<Record<string, unknown>> = [];
  const bound: string[] = [];
  return {
    creates, bound,
    findProfiles: async () => profiles,
    findUsers: async () => users,
    getUser: async (id: string) => {
      const user = users.find((entry) => entry.id === id);
      if (!user) throw new Error("Missing user");
      return user;
    },
    attachVerifiedPhone: async (id: string, attachedPhone: string) => {
      const user = users.find((entry) => entry.id === id);
      if (!user) throw new Error("Missing user");
      if (!user.phoneNumbers.some((number) => number.phoneNumber === attachedPhone)) {
        user.phoneNumbers.push({ phoneNumber: attachedPhone });
      }
      return user;
    },
    createUser: async (input: {
      phoneNumber: string[]; firstName?: string; skipPasswordRequirement: boolean;
      publicMetadata: Record<string, unknown>;
    }) => {
      creates.push(input);
      return identity("new-phone-user");
    },
    onCreated: async (user: User) => { bound.push(user.id); },
  };
};
const duplicate = (error: unknown) => error instanceof PhoneAuthError
  && error.status === 409 && error.code === "PHONE_ALREADY_REGISTERED";

test("new phone signup passes both names and password with a fixed ordinary role to Clerk", async () => {
  const deps = dependencies();
  const user = await resolvePhoneAuthUser(phone, signup(" Cheikhou "), deps);
  assert.equal(user.id, "new-phone-user");
  assert.equal(deps.creates.length, 1);
  assert.equal(deps.creates[0].firstName, "Cheikhou");
  assert.equal(deps.creates[0].lastName, "Test");
  assert.equal(deps.creates[0].password, signup().password);
  assert.equal(deps.creates[0].skipPasswordRequirement, false);
  assert.deepEqual(deps.creates[0].publicMetadata, { role: "user", phoneSignInNeedsName: false });
  assert.deepEqual(deps.bound, ["new-phone-user"]);
});

test("signup rejects a registered Clerk number instead of signing in or creating a duplicate", async () => {
  const deps = dependencies([identity()]);
  await assert.rejects(resolvePhoneAuthUser(phone, signup("New"), deps), duplicate);
  assert.equal(deps.creates.length, 0);
});

test("signup also rejects a verified marketplace-only owner", async () => {
  const deps = dependencies([], [{ clerkUserId: "owner", status: "active" }]);
  await assert.rejects(resolvePhoneAuthUser(phone, signup("New"), deps), duplicate);
  assert.equal(deps.creates.length, 0);
});

test("existing sign-in reuses the exact identity without changing names or roles", async () => {
  const existing = { ...identity(), publicMetadata: { role: "admin" } };
  const deps = dependencies([existing]);
  assert.equal(await resolvePhoneAuthUser(phone, { signup: false }, deps), existing);
  assert.equal(deps.creates.length, 0);
  assert.deepEqual(existing.publicMetadata, { role: "admin" });
});

test("existing verified marketplace profile repairs its linked Clerk phone after OTP approval", async () => {
  const linked = { ...identity(), phoneNumbers: [] as Array<{ phoneNumber: string }> };
  const deps = dependencies([], [{ clerkUserId: linked.id, status: "active" }]);
  deps.getUser = async (id: string) => {
    if (id !== linked.id) throw new Error("Missing user");
    return linked;
  };
  deps.attachVerifiedPhone = async (id: string, attachedPhone: string) => {
    if (id !== linked.id) throw new Error("Unexpected user");
    linked.phoneNumbers.push({ phoneNumber: attachedPhone });
    return linked;
  };
  assert.equal(await resolvePhoneAuthUser(phone, { signup: false }, deps), linked);
  assert.deepEqual(linked.phoneNumbers, [{ phoneNumber: phone }]);
  assert.equal(deps.creates.length, 0);
});

test("inactive and conflicting identities are denied without modifying them", async () => {
  await assert.rejects(resolvePhoneAuthUser(phone, { signup: false },
    dependencies([identity()], [{ clerkUserId: "phone-user", status: "suspended" }])),
  (error: unknown) => error instanceof PhoneAuthError && error.status === 403);
  await assert.rejects(resolvePhoneAuthUser(phone, { signup: false },
    dependencies([identity(), identity("other")])),
  (error: unknown) => error instanceof PhoneAuthError && error.status === 409);
});

test("signup creation race returns existing-number error instead of adopting another account", async () => {
  let searches = 0;
  const deps = dependencies();
  deps.findUsers = async () => ++searches === 1 ? [] : [identity("concurrent")];
  deps.createUser = async () => { throw new Error("Identifier exists"); };
  await assert.rejects(resolvePhoneAuthUser(phone, signup("New"), deps), duplicate);
  assert.deepEqual(deps.bound, []);
});

test("server-bound signup recovery reuses only the account it created", async () => {
  const user = identity("recover");
  const deps = dependencies([user]);
  assert.equal(await resolvePhoneAuthUser(phone,
    { ...signup(), recoveryUserId: "recover" }, deps), user);
  assert.equal(deps.creates.length, 0);
  await assert.rejects(resolvePhoneAuthUser(phone,
    { ...signup("New"), recoveryUserId: "somebody-else" }, deps), duplicate);
});

test("blank signup names never create a user", async () => {
  const deps = dependencies();
  await assert.rejects(resolvePhoneAuthUser(phone, signup(" "), deps));
  assert.equal(deps.creates.length, 0);
});

test("phone signup requires both trimmed names and a valid password", () => {
  assert.equal(validatePhoneSignupProfile({ ...signup(), firstName: " First ", lastName: " Last " }).firstName, "First");
  for (const fields of [
    { ...signup(), firstName: " " },
    { ...signup(), lastName: "" },
    { ...signup(), password: "" },
    { ...signup(), password: "short" },
    { ...signup(), password: "x".repeat(129) },
  ]) {
    assert.throws(() => validatePhoneSignupProfile(fields), (error: unknown) =>
      error instanceof PhoneAuthError && error.status === 400);
  }
});

test("Clerk password rejection is returned safely without creating an identity", async () => {
  const deps = dependencies();
  deps.createUser = async () => { throw { errors: [{ code: "form_password_pwned", message: "provider internals" }] }; };
  await assert.rejects(resolvePhoneAuthUser(phone, signup(), deps), (error: unknown) =>
    error instanceof PhoneAuthError && error.status === 400 && error.code === "PASSWORD_REJECTED"
      && !error.publicMessage.includes("provider internals"));
  assert.deepEqual(deps.bound, []);
});

test("legacy phone sign-in stays passwordless and never accepts signup credentials", async () => {
  const deps = dependencies();
  await resolvePhoneAuthUser(phone, { signup: false, firstName: "ignored", lastName: "ignored", password: "ignored-password" }, deps);
  assert.equal(deps.creates[0].skipPasswordRequirement, true);
  assert.equal("password" in deps.creates[0], false);
  assert.equal("lastName" in deps.creates[0], false);
});

const now = 1_000_000;
const challenge = (status: string, overrides = {}) => ({
  status, expiresAt: new Date(now + 600_000), updatedAt: new Date(now),
  failedAttempts: 0, ...overrides,
});
test("incorrect, used, rejected and expired challenges cannot authorize an identity", () => {
  for (const status of ["signed_in", "rejected", "failed", "expired", "superseded"]) {
    assert.equal(phoneChallengeAction(challenge(status), now), "invalid");
  }
  assert.equal(phoneChallengeAction(challenge("pending", { expiresAt: new Date(now) }), now), "invalid");
  assert.equal(phoneChallengeAction(challenge("pending"), now), "check");
});
test("concurrent OTP checks and finalization are leased, and exhausted attempts are blocked", () => {
  for (const status of ["checking", "finalizing"]) {
    assert.equal(phoneChallengeAction(challenge(status), now), "busy");
  }
  assert.equal(phoneChallengeAction(challenge("pending", { failedAttempts: 5 }), now), "exhausted");
});
test("phone verification limits failed codes across challenges to ten per hour", () => {
  assert.equal(maxPhoneFailedAttemptsPerHour, 10);
  assert.equal(phoneFailedAttemptsExceeded(9), false);
  assert.equal(phoneFailedAttemptsExceeded(10), true);
});
test("approved proof survives a Clerk retry without re-checking Moorsyl's one-use OTP", () => {
  assert.equal(phoneChallengeAction(challenge("approved"), now), "finalize");
  assert.equal(phoneChallengeAction(challenge("finalizing",
    { updatedAt: new Date(now - 60_001) }), now), "finalize");
});
