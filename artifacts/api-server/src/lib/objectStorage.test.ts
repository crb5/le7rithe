import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  isProductionObjectStorageConfigured,
  objectStorageClient,
  ObjectStorageService,
} from "./objectStorage";
import { isFeaturedListingVisible } from "./featured-listing-policy";

type MockFile = {
  name: string;
  metadata: { timeCreated?: string };
  delete: () => Promise<void>;
};

type BucketMock = {
  getFiles: (options: { prefix: string }) => Promise<[MockFile[]]>;
};

const privateObjectDir = "/payment-proof-bucket/private";
const uploadsPrefix = "private/uploads/";
const olderThan = new Date("2026-09-08T00:00:00.000Z");

const objectPath = (id: string) => `/objects/uploads/${id}`;
const fileName = (id: string) => `${uploadsPrefix}${id}`;

const makeFile = (
  id: string,
  deleteFile: () => Promise<void> = async () => {},
): MockFile => ({
  name: fileName(id),
  metadata: { timeCreated: "2026-09-07T00:00:00.000Z" },
  delete: deleteFile,
});

const storage = objectStorageClient as unknown as {
  bucket: (name: string) => BucketMock;
};
const originalBucket = storage.bucket;

describe("ObjectStorageService.cleanupUnreferencedPaymentProofs", () => {
  let service: ObjectStorageService;

  beforeEach(() => {
    process.env.PRIVATE_OBJECT_DIR = privateObjectDir;
    service = new ObjectStorageService();
  });

  afterEach(() => {
    storage.bucket = originalBucket;
    delete process.env.PRIVATE_OBJECT_DIR;
  });

  it("deletes an old upload that is not referenced by a payment", async () => {
    const abandonedFile = makeFile("11111111-1111-4111-8111-111111111111");
    const deletedFiles: string[] = [];
    abandonedFile.delete = async () => {
      deletedFiles.push(abandonedFile.name);
    };
    storage.bucket = () => ({
      getFiles: async ({ prefix }) => {
        assert.equal(prefix, uploadsPrefix);
        return [[abandonedFile]];
      },
    });

    const result = await service.cleanupUnreferencedPaymentProofs({
      referencedObjectPaths: new Set(),
      olderThan,
    });

    assert.deepEqual(result, {
      scanned: 1,
      deleted: 1,
      failedObjectPaths: [],
    });
    assert.deepEqual(deletedFiles, [abandonedFile.name]);
  });

  it("preserves a referenced proof from a rejected payment", async () => {
    const rejectedPaymentProofId = "22222222-2222-4222-8222-222222222222";
    const rejectedPayment = {
      status: "rejected",
      proofImageUrl: objectPath(rejectedPaymentProofId),
    };
    const referencedFile = makeFile(rejectedPaymentProofId);
    const deletedFiles: string[] = [];
    referencedFile.delete = async () => {
      deletedFiles.push(referencedFile.name);
    };
    storage.bucket = () => ({
      getFiles: async () => [[referencedFile]],
    });

    const result = await service.cleanupUnreferencedPaymentProofs({
      referencedObjectPaths: new Set([rejectedPayment.proofImageUrl]),
      olderThan,
    });

    assert.deepEqual(result, {
      scanned: 0,
      deleted: 0,
      failedObjectPaths: [],
    });
    assert.deepEqual(deletedFiles, []);
  });

  it("continues deleting after one file fails and reports the failed path", async () => {
    const failedId = "33333333-3333-4333-8333-333333333333";
    const deletedId = "44444444-4444-4444-8444-444444444444";
    const attemptedDeletes: string[] = [];
    const failedFile = makeFile(failedId, async () => {
      attemptedDeletes.push(failedId);
      throw new Error("storage delete failed");
    });
    const deletedFile = makeFile(deletedId, async () => {
      attemptedDeletes.push(deletedId);
    });
    storage.bucket = () => ({
      getFiles: async () => [[failedFile, deletedFile]],
    });

    const result = await service.cleanupUnreferencedPaymentProofs({
      referencedObjectPaths: new Set(),
      olderThan,
    });

    assert.deepEqual(result, {
      scanned: 2,
      deleted: 1,
      failedObjectPaths: [objectPath(failedId)],
    });
    assert.deepEqual(attemptedDeletes, [failedId, deletedId]);
  });
});

describe("production object storage readiness", () => {
  it("is not ready when required App Storage settings are absent", () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalPrivateObjectDir = process.env.PRIVATE_OBJECT_DIR;
    const originalBucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;

    try {
      process.env.NODE_ENV = "production";
      delete process.env.PRIVATE_OBJECT_DIR;
      delete process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;

      assert.equal(isProductionObjectStorageConfigured(), false);
    } finally {
      if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = originalNodeEnv;
      if (originalPrivateObjectDir === undefined) delete process.env.PRIVATE_OBJECT_DIR;
      else process.env.PRIVATE_OBJECT_DIR = originalPrivateObjectDir;
      if (originalBucketId === undefined) delete process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
      else process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID = originalBucketId;
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