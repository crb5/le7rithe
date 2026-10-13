import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import {
  ObjectNotFoundError,
  objectStorageClient,
  ObjectStorageService,
} from "./objectStorage";

const probeBody = Buffer.from("private object storage cleanup probe");

class LiveCheckFailure extends Error {
  constructor(readonly step: string) {
    super(`live private object storage check failed during ${step}`);
    this.name = "LiveCheckFailure";
  }
}

const requirePrivateObjectDir = (): void => {
  const privateObjectDir = process.env.PRIVATE_OBJECT_DIR?.trim();
  if (
    !privateObjectDir ||
    !/^\/[^/]+\/private(?:\/|$)/i.test(privateObjectDir) ||
    /^(?:https?:|gs:)/i.test(privateObjectDir)
  ) {
    throw new LiveCheckFailure("private bucket configuration");
  }
};

const uploadProbe = async (
  service: ObjectStorageService,
  objectId: string,
): Promise<string> => {
  const uploadUrl = await service.getObjectEntityUploadURL("uploads", objectId);
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "application/octet-stream" },
    body: probeBody,
  });
  if (!response.ok) throw new Error("probe upload failed");

  const objectPath = service.normalizeObjectEntityPath(uploadUrl);
  if (!objectPath.startsWith("/objects/uploads/")) {
    throw new Error("probe upload returned an invalid object path");
  }
  return objectPath;
};

const existingObjectPaths = async (
  service: ObjectStorageService,
): Promise<string[]> => {
  const privateObjectDir = service.getPrivateObjectDir().replace(/^\/+/, "");
  const separator = privateObjectDir.indexOf("/");
  if (separator <= 0 || separator === privateObjectDir.length - 1) {
    throw new Error("private bucket configuration is invalid");
  }

  const bucketName = privateObjectDir.slice(0, separator);
  const uploadsPrefix = `${privateObjectDir.slice(separator + 1)}/uploads/`;
  const [files] = await objectStorageClient.bucket(bucketName).getFiles({
    prefix: uploadsPrefix,
  });
  return files
    .filter((file) => file.name.startsWith(uploadsPrefix))
    .map((file) => `/objects/uploads/${file.name.slice(uploadsPrefix.length)}`);
};

const assertObjectExists = async (
  service: ObjectStorageService,
  objectPath: string,
  expected: boolean,
): Promise<void> => {
  try {
    await service.getObjectEntityFile(objectPath);
    assert.equal(expected, true, "eligible probe object was not deleted");
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      assert.equal(expected, false, "referenced probe object was deleted");
      return;
    }
    throw error;
  }
};

const deleteProbeIfPresent = async (
  service: ObjectStorageService,
  objectPath: string,
): Promise<void> => {
  try {
    const file = await service.getObjectEntityFile(objectPath);
    await file.delete({ ignoreNotFound: true });
  } catch (error) {
    if (!(error instanceof ObjectNotFoundError)) throw error;
  }
};

describe("live private payment-proof cleanup", () => {
  it("deletes only an old unreferenced probe and preserves a referenced probe", async () => {
    const service = new ObjectStorageService();
    let abandonedObjectPath: string | undefined;
    let referencedObjectPath: string | undefined;
    let checkFailure: unknown;
    let teardownFailed = false;

    try {
      requirePrivateObjectDir();
      const abandonedObjectId = randomUUID();
      const referencedObjectId = randomUUID();
      abandonedObjectPath = await uploadProbe(service, abandonedObjectId);
      referencedObjectPath = await uploadProbe(service, referencedObjectId);
      const referencedObjectPaths = new Set(
        await existingObjectPaths(service),
      );
      // Protect every object that was already in the shared uploads prefix.
      // Only the newly-created abandoned probe is intentionally unreferenced.
      referencedObjectPaths.add(referencedObjectPath);
      referencedObjectPaths.delete(abandonedObjectPath);

      const result = await service.cleanupUnreferencedPaymentProofs({
        referencedObjectPaths,
        // Both probes were just created, so this cutoff makes their age
        // deterministic without mutating provider-managed creation metadata.
        olderThan: new Date(Date.now() + 60_000),
      });

      assert.equal(result.scanned, 1, "cleanup scanned an unexpected number of probes");
      assert.equal(result.deleted, 1, "cleanup deleted an unexpected number of probes");
      assert.equal(
        result.failedObjectPaths.length,
        0,
        "cleanup reported a failed probe deletion",
      );

      await assertObjectExists(service, abandonedObjectPath, false);
      await assertObjectExists(service, referencedObjectPath, true);
    } catch (error) {
      checkFailure = error;
    } finally {
      for (const objectPath of [abandonedObjectPath, referencedObjectPath]) {
        if (!objectPath) continue;
        try {
          await deleteProbeIfPresent(service, objectPath);
        } catch {
          teardownFailed = true;
        }
      }
    }

    if (checkFailure || teardownFailed) {
      const step =
        checkFailure instanceof LiveCheckFailure
          ? checkFailure.step
          : teardownFailed
            ? "probe cleanup"
            : "cleanup assertions";
      console.error(
        `Live private object storage cleanup check failed during ${step}. ` +
          "No bucket URLs or object contents were logged.",
      );
      throw new Error(`Live private object storage cleanup check failed during ${step}.`);
    }
  });
});