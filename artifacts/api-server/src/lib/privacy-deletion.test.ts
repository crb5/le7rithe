import assert from "node:assert/strict";
import test from "node:test";
import {
  deleteMarketplaceAccount,
  type AccountDeletionSnapshot,
  type AccountDeletionStore,
} from "./privacy-deletion";

const syntheticClerkUserId = "user_synthetic_privacy_delete_test";

function fixture() {
  const events: string[] = [];
  let pending = false;
  let erased = false;
  let finalized = false;
  let media = ["/objects/listing-images/11111111-1111-4111-8111-111111111111"];
  let failStorage = false;
  let failClerk = false;

  const store: AccountDeletionStore = {
    begin: async (clerkUserId): Promise<AccountDeletionSnapshot | null> => {
      events.push("begin");
      if (clerkUserId !== syntheticClerkUserId) return null;
      pending = true;
      return { clerkUserId, personalObjectPaths: [...media] };
    },
    eraseMarketplaceData: async (clerkUserId) => {
      assert.equal(clerkUserId, syntheticClerkUserId);
      assert.equal(pending, true);
      events.push("erase");
      erased = true;
      media = [];
      return [];
    },
    finalize: async (clerkUserId) => {
      assert.equal(clerkUserId, syntheticClerkUserId);
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
    failClerk: (value: boolean) => { failClerk = value; },
    deleteObject: async (path: string) => {
      events.push(`delete-object:${path}`);
      if (failStorage) throw new Error("synthetic storage failure");
      media = media.filter((item) => item !== path);
    },
    deleteClerkUser: async (clerkUserId: string) => {
      events.push(`delete-clerk:${clerkUserId}`);
      if (failClerk) throw new Error("synthetic Clerk failure");
    },
  };
}

test("deletes only the synthetic account, its media, and its local data", async () => {
  const f = fixture();
  const deleted = await deleteMarketplaceAccount(syntheticClerkUserId, f);

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
    `delete-clerk:${syntheticClerkUserId}`,
    "finalize",
  ]);
});

test("does not erase database or Clerk data when storage cleanup fails", async () => {
  const f = fixture();
  f.failStorage(true);

  await assert.rejects(
    deleteMarketplaceAccount(syntheticClerkUserId, f),
    /synthetic storage failure/,
  );
  assert.equal(f.state().pending, true);
  assert.equal(f.state().erased, false);
  assert.equal(f.state().finalized, false);
  assert.equal(f.events.some((event) => event.startsWith("delete-clerk:")), false);
});

test("keeps the account pending after a Clerk failure so deletion can be retried", async () => {
  const f = fixture();
  f.failClerk(true);

  await assert.rejects(
    deleteMarketplaceAccount(syntheticClerkUserId, f),
    /synthetic Clerk failure/,
  );
  assert.equal(f.state().erased, true);
  assert.equal(f.state().finalized, false);

  f.failClerk(false);
  assert.equal(await deleteMarketplaceAccount(syntheticClerkUserId, f), true);
  assert.equal(f.state().finalized, true);
});

test("does not run deletion for an unknown account", async () => {
  const f = fixture();
  assert.equal(await deleteMarketplaceAccount("user_not_found", f), false);
  assert.deepEqual(f.events, ["begin"]);
});
