import assert from "node:assert/strict";
import test from "node:test";
import {
  deleteMarketplaceAccount,
  type AccountDeletionSnapshot,
  type AccountDeletionStore,
} from "./privacy-deletion";

const syntheticOidcSubject = "user_synthetic_privacy_delete_test";

function fixture() {
  const events: string[] = [];
  let pending = false;
  let erased = false;
  let finalized = false;
  let media = ["/objects/listing-images/11111111-1111-4111-8111-111111111111"];
  let failStorage = false;
  let failIdentityProviderDeletion = false;

  const store: AccountDeletionStore = {
    begin: async (oidcSubject): Promise<AccountDeletionSnapshot | null> => {
      events.push("begin");
      if (oidcSubject !== syntheticOidcSubject) return null;
      pending = true;
      return { oidcSubject, personalObjectPaths: [...media] };
    },
    eraseMarketplaceData: async (oidcSubject) => {
      assert.equal(oidcSubject, syntheticOidcSubject);
      assert.equal(pending, true);
      events.push("erase");
      erased = true;
      media = [];
      return [];
    },
    finalize: async (oidcSubject) => {
      assert.equal(oidcSubject, syntheticOidcSubject);
      assert.equal(erased, true);
      events.push("finalize");
      finalized = true;
    },
  };

  return {
    events,
    store,
    state: () => ({ pending, erased, finalized, media }),
    failStorage: (value: boolean) => { failStorage = value; },
    failIdentityProviderDeletion: (value: boolean) => { failIdentityProviderDeletion = value; },
    deleteObject: async (path: string) => {
      events.push(`delete-object:${path}`);
      if (failStorage) throw new Error("synthetic storage failure");
      media = media.filter((item) => item !== path);
    },
    deleteIdentityProviderUser: async (oidcSubject: string) => {
      events.push(`delete-oidc:${oidcSubject}`);
      if (failIdentityProviderDeletion) throw new Error("synthetic identity provider failure");
    },
  };
}

test("deletes only the synthetic account, its media, and its local data", async () => {
  const f = fixture();
  const deleted = await deleteMarketplaceAccount(syntheticOidcSubject, f);

  assert.equal(deleted, true);
  assert.deepEqual(f.state(), {
    pending: true,
    erased: true,
    finalized: true,
    media: [],
  });
  assert.deepEqual(f.events, [
    "begin",
    "delete-object:/objects/listing-images/11111111-1111-4111-8111-111111111111",
    "erase",
    `delete-oidc:${syntheticOidcSubject}`,
    "finalize",
  ]);
});

test("does not erase database or identity provider data when storage cleanup fails", async () => {
  const f = fixture();
  f.failStorage(true);

  await assert.rejects(
    deleteMarketplaceAccount(syntheticOidcSubject, f),
    /synthetic storage failure/,
  );
  assert.equal(f.state().pending, true);
  assert.equal(f.state().erased, false);
  assert.equal(f.state().finalized, false);
  assert.equal(f.events.some((event) => event.startsWith("delete-oidc:")), false);
});

test("keeps the account pending after an identity provider failure so deletion can be retried", async () => {
  const f = fixture();
  f.failIdentityProviderDeletion(true);

  await assert.rejects(
    deleteMarketplaceAccount(syntheticOidcSubject, f),
    /synthetic identity provider failure/,
  );
  assert.equal(f.state().erased, true);
  assert.equal(f.state().finalized, false);

  f.failIdentityProviderDeletion(false);
  assert.equal(await deleteMarketplaceAccount(syntheticOidcSubject, f), true);
  assert.equal(f.state().finalized, true);
});

test("does not run deletion for an unknown account", async () => {
  const f = fixture();
  assert.equal(await deleteMarketplaceAccount("user_not_found", f), false);
  assert.deepEqual(f.events, ["begin"]);
});
