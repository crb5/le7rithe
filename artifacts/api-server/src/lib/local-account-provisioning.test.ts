import assert from "node:assert/strict";
import test from "node:test";
import { provisionLocalAccount, type LocalAccountDraft } from "./local-account-provisioning";

const user = () => ({
  id: "user_new_clerk_application",
  primaryEmailAddressId: "email_primary",
  emailAddresses: [{
    id: "email_primary",
    emailAddress: "Owner@example.test",
    verification: { status: "verified" },
  }],
  firstName: "Site",
  lastName: "Owner",
});
type Account = Omit<LocalAccountDraft, "role" | "status"> & { id: number; role: string; status: string };

function fixture(existing: Account | null = null) {
  const clerkUser = user();
  const inserts: LocalAccountDraft[] = [];
  const promotions: Account[] = [];
  const input = {
    clerkUserId: clerkUser.id,
    existing,
    fallbackName: "Ordinary User",
    // Client/session email alone must never grant a role.
    fallbackEmail: "owner@example.test",
    allowedEmails: "owner@example.test" as string | undefined,
  };
  const store = {
    loadClerkUser: async () => clerkUser,
    reconnectAdministrator: async (_email: string): Promise<Account | null> => null,
    create: async (draft: LocalAccountDraft) => {
      inserts.push(draft);
      return { id: 1, ...draft };
    },
    promote: async (account: Account, email: string): Promise<Account> => {
      const updated: Account = { ...account, email, role: "admin" };
      promotions.push(updated);
      return updated;
    },
  };
  return { clerkUser, input, store, inserts, promotions };
}

test("new Clerk ID + verified allowed primary email + no local account inserts an active admin", async () => {
  const f = fixture();
  const account = await provisionLocalAccount(f.input, f.store);
  assert.equal(f.input.existing, null);
  assert.equal(f.inserts.length, 1);
  assert.equal(f.inserts[0].clerkUserId, "user_new_clerk_application");
  assert.equal(account.role, "admin");
  assert.equal(account.status, "active");
  assert.equal(account.email, "owner@example.test");
});

test("first authenticated use promotes an existing active ordinary account without replacing its ID", async () => {
  const existing: Account = {
    id: 42, clerkUserId: user().id, name: "Owner", email: null, initials: "O", role: "user", status: "active",
  };
  const f = fixture(existing);
  const account = await provisionLocalAccount(f.input, f.store);
  assert.equal(account.id, 42);
  assert.equal(account.role, "admin");
  assert.equal(f.inserts.length, 0);
  assert.equal(f.promotions.length, 1);
});

test("unverified allowed email creates an ordinary account, not an admin", async () => {
  const f = fixture();
  f.clerkUser.emailAddresses[0].verification.status = "unverified";
  assert.equal((await provisionLocalAccount(f.input, f.store)).role, "user");
});

test("a forged fallback email cannot authorize an unrelated Clerk primary email", async () => {
  const f = fixture();
  f.clerkUser.emailAddresses[0].emailAddress = "someone@example.test";
  assert.equal((await provisionLocalAccount(f.input, f.store)).role, "user");
});

test("missing allowlist never grants administration", async () => {
  const f = fixture();
  f.input.allowedEmails = undefined;
  assert.equal((await provisionLocalAccount(f.input, f.store)).role, "user");
});

test("inactive local account is not promoted or reactivated", async () => {
  const f = fixture();
  const existing = { id: 42, clerkUserId: user().id, name: "Owner", email: null, initials: "O", role: "user", status: "suspended" };
  const account = await provisionLocalAccount({ ...f.input, existing }, f.store);
  assert.equal(account.status, "suspended");
  assert.equal(account.role, "user");
  assert.equal(f.inserts.length, 0);
  assert.equal(f.promotions.length, 0);
});

test("Clerk lookup failure does not silently create or promote an administrator", async () => {
  const f = fixture();
  f.store.loadClerkUser = async () => { throw new Error("Clerk unavailable"); };
  await assert.rejects(provisionLocalAccount(f.input, f.store), /Clerk unavailable/);
  assert.equal(f.inserts.length, 0);
  assert.equal(f.promotions.length, 0);
});

test("first marketplace use reconnects the retained owner instead of inserting a replacement", async () => {
  const f = fixture();
  f.store.reconnectAdministrator = async email => ({
    id: 42, clerkUserId: f.input.clerkUserId, name: "Retained Owner",
    email, initials: "RO", role: "admin", status: "active",
  });
  const account = await provisionLocalAccount(f.input, f.store);
  assert.equal(account.id, 42);
  assert.equal(account.clerkUserId, f.input.clerkUserId);
  assert.equal(f.inserts.length, 0);
});

test("unverified and unrelated identities cannot attempt owner reconnection", async () => {
  for (const scenario of ["unverified", "unrelated"]) {
    const f = fixture();
    if (scenario === "unverified") f.clerkUser.emailAddresses[0].verification.status = "unverified";
    else f.clerkUser.emailAddresses[0].emailAddress = "someone@example.test";
    f.store.reconnectAdministrator = async () => {
      assert.fail("Unauthorized identity attempted owner reconnection");
    };
    assert.equal((await provisionLocalAccount(f.input, f.store)).role, "user");
  }
});

test("ambiguous or inactive retained owners fail without creating a replacement administrator", async () => {
  for (const reason of ["Ambiguous local administrator identity", "Local administrator is inactive"]) {
    const f = fixture();
    f.store.reconnectAdministrator = async () => { throw new Error(reason); };
    await assert.rejects(provisionLocalAccount(f.input, f.store), new RegExp(reason));
    assert.equal(f.inserts.length, 0);
  }
});
