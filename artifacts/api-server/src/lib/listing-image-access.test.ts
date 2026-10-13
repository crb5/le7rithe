import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getListingImageAccessPolicy,
  listingImageRequiresConsent,
} from "./listing-image-access";

describe("listing image access policy", () => {
  it("denies suspended users, including administrators and moderators", () => {
    for (const role of ["user", "admin", "moderator"]) {
      assert.deepEqual(
        getListingImageAccessPolicy({ id: 7, role, status: "suspended" }),
        { kind: "deny" },
      );
    }
  });

  it("preserves full listing access for active administrators and moderators", () => {
    for (const role of ["admin", "moderator"]) {
      assert.deepEqual(
        getListingImageAccessPolicy({ id: 7, role, status: "active" }),
        { kind: "all" },
      );
    }
  });

  it("preserves active listings and seller-owned listing access for active users", () => {
    assert.deepEqual(
      getListingImageAccessPolicy({ id: 42, role: "user", status: "active" }),
      { kind: "owner-or-active", sellerId: 42 },
    );
  });

  it("keeps unauthenticated access limited to active public listings", () => {
    assert.deepEqual(getListingImageAccessPolicy(null), { kind: "active-only" });
  });

  it("keeps public listing images available before consent", () => {
    assert.equal(
      listingImageRequiresConsent(
        getListingImageAccessPolicy({ id: 42, role: "user", status: "active" }),
        true,
      ),
      false,
    );
  });

  it("requires consent before an owner or administrator reads a non-public image", () => {
    assert.equal(
      listingImageRequiresConsent(
        getListingImageAccessPolicy({ id: 42, role: "user", status: "active" }),
        false,
      ),
      true,
    );
    assert.equal(
      listingImageRequiresConsent(
        getListingImageAccessPolicy({ id: 7, role: "admin", status: "active" }),
        false,
      ),
      true,
    );
    assert.equal(
      listingImageRequiresConsent(getListingImageAccessPolicy(null), false),
      false,
    );
  });
});
