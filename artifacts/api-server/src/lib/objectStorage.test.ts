import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  isProductionObjectStorageConfigured,
  ObjectStorageService,
} from "./objectStorage";
import { isFeaturedListingVisible } from "./featured-listing-policy";

const olderThan = new Date("2026-09-08T00:00:00.000Z");
const objectPath = (id: string) => `/objects/uploads/${id}`;

describe("ObjectStorageService.cleanupUnreferencedPaymentProofs", () => {
  let service: ObjectStorageService;
  let root: string;

  const writeUpload = async (id: string, timeCreated = "2026-09-07T00:00:00.000Z") => {
    const dir = path.join(root, "uploads");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, id), Buffer.from("proof-bytes"));
    await writeFile(
      path.join(dir, `${id}.meta.json`),
      JSON.stringify({ contentType: "image/webp", timeCreated }),
      "utf8",
    );
  };

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "object-storage-test-"));
    process.env.OBJECT_STORAGE_DIR = root;
    service = new ObjectStorageService();
  });

  afterEach(async () => {
    delete process.env.OBJECT_STORAGE_DIR;
    await rm(root, { recursive: true, force: true });
  });

  it("deletes an old upload that is not referenced by a payment", async () => {
    const id = "11111111-1111-4111-8111-111111111111";
    await writeUpload(id);

    const result = await service.cleanupUnreferencedPaymentProofs({
      referencedObjectPaths: new Set(),
      olderThan,
    });

    assert.deepEqual(result, { scanned: 1, deleted: 1, failedObjectPaths: [] });
    const [exists] = await service
      .getObjectEntityFile(objectPath(id))
      .then(() => [true])
      .catch(() => [false]);
    assert.equal(exists, false);
  });

  it("preserves a referenced proof from a rejected payment", async () => {
    const id = "22222222-2222-4222-8222-222222222222";
    await writeUpload(id);

    const result = await service.cleanupUnreferencedPaymentProofs({
      referencedObjectPaths: new Set([objectPath(id)]),
      olderThan,
    });

    assert.deepEqual(result, { scanned: 0, deleted: 0, failedObjectPaths: [] });
  });

  it("preserves a recently uploaded proof even when unreferenced", async () => {
    const id = "55555555-5555-4555-8555-555555555555";
    await writeUpload(id, "2026-09-09T00:00:00.000Z");

    const result = await service.cleanupUnreferencedPaymentProofs({
      referencedObjectPaths: new Set(),
      olderThan,
    });

    assert.deepEqual(result, { scanned: 0, deleted: 0, failedObjectPaths: [] });
  });
});

describe("production object storage readiness", () => {
  it("is not ready when the storage directory is not configured", () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalDir = process.env.OBJECT_STORAGE_DIR;

    try {
      process.env.NODE_ENV = "production";
      delete process.env.OBJECT_STORAGE_DIR;

      assert.equal(isProductionObjectStorageConfigured(), false);
    } finally {
      if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = originalNodeEnv;
      if (originalDir === undefined) delete process.env.OBJECT_STORAGE_DIR;
      else process.env.OBJECT_STORAGE_DIR = originalDir;
    }
  });
});

describe("featured listing visibility workflow", () => {
  it("keeps the listing hidden until confirmed payment and admin publication", () => {
    const listing = {
      status: "pending_payment",
      featured: false,
      hasConfirmedFeaturedPayment: false,
    };

    assert.equal(isFeaturedListingVisible(listing), false);

    const paymentConfirmed = {
      ...listing,
      hasConfirmedFeaturedPayment: true,
    };
    assert.equal(isFeaturedListingVisible(paymentConfirmed), false);

    const published = {
      ...paymentConfirmed,
      status: "active",
      featured: true,
    };
    assert.equal(isFeaturedListingVisible(published), true);
  });

  it("keeps a featured listing visible until the admin removes featuring", () => {
    const published = {
      status: "active",
      featured: true,
      hasConfirmedFeaturedPayment: true,
    };

    assert.equal(isFeaturedListingVisible(published), true);
    assert.equal(
      isFeaturedListingVisible({ ...published, featured: false }),
      false,
    );
  });
});
