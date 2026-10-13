import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { File, Storage } from "@google-cloud/storage";
import { setObjectAclPolicy, type ObjectAclPolicy } from "./objectAcl";
import {
  InvalidPaymentProofImageError,
  isPaymentProofObjectPath,
  isPaymentProofOwnedByUser,
  isPaymentProofUploadObjectName,
  maxPaymentProofBytes,
  paymentProofContentTypes,
  stripPaymentProofImageMetadata,
} from "./paymentProof";
import {
  canonicalListingImageReference,
  isOwnedListingImageInput,
  listingImageInputId,
} from "./listing-image-processing";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";
export const objectStorageClient = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: {
        type: "json",
        subject_token_field_name: "access_token",
      },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export class ObjectStorageService {
  getPrivateObjectDir(): string {
    const dir = process.env.PRIVATE_OBJECT_DIR || "";
    if (!dir) {
      throw new Error(
        "PRIVATE_OBJECT_DIR not set. Create a bucket in 'Object Storage' tool and set PRIVATE_OBJECT_DIR env var.",
      );
    }
    return dir;
  }

  async getObjectEntityUploadURL(
    prefix = "uploads",
    objectId: string = randomUUID(),
  ): Promise<string> {
    if (
      !/^[a-z0-9-]+$/i.test(prefix) ||
      !/^[a-z0-9._-]+$/i.test(objectId)
    ) {
      throw new Error("Invalid object storage upload prefix");
    }
    const privateObjectDir = this.getPrivateObjectDir();
    const { bucketName, objectName } = parseObjectPath(
      `${privateObjectDir}/${prefix}/${objectId}`,
    );
    return signObjectURL({
      bucketName,
      objectName,
      method: "PUT",
      ttlSec: 900,
    });
  }

  normalizeObjectEntityPath(rawPath: string): string {
    if (!rawPath.startsWith("https://storage.googleapis.com/")) {
      return rawPath;
    }

    const url = new URL(rawPath);
    const rawObjectPath = url.pathname;
    let objectEntityDir = this.getPrivateObjectDir();
    if (!objectEntityDir.endsWith("/")) objectEntityDir += "/";
    if (!rawObjectPath.startsWith(objectEntityDir)) return rawObjectPath;
    return `/objects/${rawObjectPath.slice(objectEntityDir.length)}`;
  }

  async getObjectEntityFile(objectPath: string): Promise<File> {
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }

    const entityId = objectPath.slice("/objects/".length);
    if (!entityId) throw new ObjectNotFoundError();

    const privateObjectDir = this.getPrivateObjectDir();
    const { bucketName, objectName } = parseObjectPath(
      `${privateObjectDir}/${entityId}`,
    );
    const objectFile = objectStorageClient.bucket(bucketName).file(objectName);
    const [exists] = await objectFile.exists();
    if (!exists) throw new ObjectNotFoundError();
    return objectFile;
  }

  async deleteObjectIfExists(objectPath: string): Promise<void> {
    const safeObjectPath = normalizeManagedObjectPath(objectPath);
    if (!safeObjectPath) throw new Error("Invalid private object path");
    const entityId = safeObjectPath.slice("/objects/".length);
    const privateObjectDir = this.getPrivateObjectDir();
    const { bucketName, objectName } = parseObjectPath(`${privateObjectDir}/${entityId}`);
    await objectStorageClient.bucket(bucketName).file(objectName).delete({
      ignoreNotFound: true,
    });
  }

  async deleteListingImageArtifacts(imagePaths: readonly string[]): Promise<void> {
    const paths = new Set<string>();
    for (const path of imagePaths) {
      const normalized = this.normalizeObjectEntityPath(
        canonicalListingImageReference(path),
      );
      const match = /^\/objects\/listing-images\/([0-9a-f-]{36})$/i.exec(normalized);
      if (match) {
        paths.add(normalized);
        paths.add(`/objects/listing-images-thumbnails/${match[1]}`);
        continue;
      }
      // Older listing uploads used a bare UUID in the uploads prefix. Do not
      // match signed payment-proof paths here.
      if (/^\/objects\/uploads\/[0-9a-f-]{36}$/i.test(normalized)) {
        paths.add(normalized);
      }
    }
    for (const objectPath of paths) {
      await this.deleteObjectIfExists(objectPath);
    }
  }

  async listOwnedPersonalDataObjectPaths(
    owner: string,
    knownPaths: readonly string[] = [],
  ): Promise<string[]> {
    const privateObjectDir = this.getPrivateObjectDir();
    const { bucketName, objectName: rootObjectName } = parseObjectPath(privateObjectDir);
    const bucket = objectStorageClient.bucket(bucketName);
    const result = new Set<string>();
    const addPath = (path: string) => {
      const safePath = normalizeManagedObjectPath(path);
      if (safePath) result.add(safePath);
    };

    for (const path of knownPaths) {
      const normalized = this.normalizeObjectEntityPath(
        canonicalListingImageReference(path),
      );
      addPath(normalized);
      const imageMatch = /^\/objects\/listing-images\/([0-9a-f-]{36})$/i.exec(normalized);
      if (imageMatch) {
        addPath(`/objects/listing-images-thumbnails/${imageMatch[1]}`);
      }
    }

    const inputPrefix = `${rootObjectName}/listing-image-inputs/${listingImageInputId(owner, "")}`;
    const [inputFiles] = await bucket.getFiles({ prefix: inputPrefix });
    for (const file of inputFiles) {
      const objectPath = `/objects/listing-image-inputs/${file.name.slice(inputPrefix.length - `${rootObjectName}/`.length)}`;
      if (isOwnedListingImageInput(objectPath, owner)) addPath(objectPath);
    }

    for (const prefix of ["listing-images", "listing-images-thumbnails"]) {
      const fullPrefix = `${rootObjectName}/${prefix}/`;
      const [files] = await bucket.getFiles({ prefix: fullPrefix });
      for (const file of files) {
        const imageId = file.name.slice(fullPrefix.length);
        if (!/^[0-9a-f-]{36}$/i.test(imageId)) continue;
        const aclPolicyValue = file.metadata.metadata?.["custom:aclPolicy"];
        if (typeof aclPolicyValue !== "string") continue;
        try {
          const policy = JSON.parse(aclPolicyValue) as { owner?: unknown; visibility?: unknown };
          if (policy.owner === owner && policy.visibility === "private") {
            addPath(`/objects/${prefix}/${imageId}`);
          }
        } catch {
          // Malformed ownership metadata is not sufficient proof to delete an object.
        }
      }
    }

    const uploadsPrefix = `${rootObjectName}/uploads/`;
    const [uploads] = await bucket.getFiles({ prefix: uploadsPrefix });
    for (const file of uploads) {
      const objectName = file.name.slice(rootObjectName.length + 1);
      const objectPath = `/objects/${objectName}`;
      if (isPaymentProofObjectPath(objectPath) && isPaymentProofOwnedByUser(objectPath, owner)) {
        addPath(objectPath);
      }
    }

    return [...result];
  }

  async sanitizePaymentProofObject(objectPath: string, owner: string): Promise<void> {
    if (!isPaymentProofObjectPath(objectPath)) {
      throw new InvalidPaymentProofImageError();
    }
    const file = await this.getObjectEntityFile(objectPath);
    const [metadata] = await file.getMetadata();
    const contentType = typeof metadata.contentType === "string" ? metadata.contentType : "";
    const size = Number(metadata.size);
    if (
      !paymentProofContentTypes.has(contentType) ||
      !Number.isFinite(size) ||
      size <= 0 ||
      size > maxPaymentProofBytes
    ) {
      throw new InvalidPaymentProofImageError();
    }
    const [input] = await file.download();
    const sanitized = await stripPaymentProofImageMetadata(input, contentType);
    const generation = Number(metadata.generation);
    if (!Number.isSafeInteger(generation) || generation <= 0) {
      throw new Error("Payment proof generation metadata is unavailable");
    }
    await file.save(sanitized, {
      resumable: false,
      preconditionOpts: { ifGenerationMatch: generation },
      metadata: {
        contentType,
        metadata: {
          ...(metadata.metadata ?? {}),
          "custom:aclPolicy": JSON.stringify({ owner, visibility: "private" }),
        },
      },
    });
  }

  async cleanupLegacyListingImageInputs({
    apply,
    olderThan,
  }: {
    apply: boolean;
    olderThan: Date;
  }): Promise<{
    alreadyCompleted: boolean;
    scanned: number;
    eligible: number;
    deleted: number;
    failed: number;
  }> {
    const privateObjectDir = this.getPrivateObjectDir();
    const { bucketName, objectName: rootObjectName } = parseObjectPath(privateObjectDir);
    const bucket = objectStorageClient.bucket(bucketName);
    const markerName = `${rootObjectName}/system/privacy-cleanups/listing-image-originals-v1.complete`;
    const markerFile = bucket.file(markerName);
    const [alreadyCompleted] = await markerFile.exists();
    if (alreadyCompleted) {
      return { alreadyCompleted: true, scanned: 0, eligible: 0, deleted: 0, failed: 0 };
    }

    const inputPrefix = `${rootObjectName}/listing-image-inputs/`;
    const [files] = await bucket.getFiles({ prefix: inputPrefix });
    const eligibleFiles = files.filter((file) => {
      const id = file.name.slice(inputPrefix.length);
      const createdAt = file.metadata.timeCreated
        ? Date.parse(file.metadata.timeCreated)
        : Number.NaN;
      return (
        /^[0-9a-f]{32}-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) &&
        Number.isFinite(createdAt) &&
        createdAt < olderThan.getTime()
      );
    });

    if (!apply) {
      return {
        alreadyCompleted: false,
        scanned: files.length,
        eligible: eligibleFiles.length,
        deleted: 0,
        failed: 0,
      };
    }

    let deleted = 0;
    let failed = 0;
    for (const file of eligibleFiles) {
      try {
        await file.delete({ ignoreNotFound: true });
        deleted += 1;
      } catch {
        failed += 1;
      }
    }

    if (failed === 0) {
      await markerFile.save(JSON.stringify({
        completedAt: new Date().toISOString(),
        scanned: files.length,
        eligible: eligibleFiles.length,
        deleted,
      }), {
        resumable: false,
        preconditionOpts: { ifGenerationMatch: 0 },
        metadata: { contentType: "application/json" },
      });
    }

    return {
      alreadyCompleted: false,
      scanned: files.length,
      eligible: eligibleFiles.length,
      deleted,
      failed,
    };
  }

  async cleanupUnreferencedPaymentProofs({
    referencedObjectPaths,
    olderThan,
  }: {
    referencedObjectPaths: ReadonlySet<string>;
    olderThan: Date;
  }): Promise<{
    scanned: number;
    deleted: number;
    failedObjectPaths: string[];
  }> {
    const privateObjectDir = this.getPrivateObjectDir();
    const { bucketName, objectName: uploadsObjectName } = parseObjectPath(
      `${privateObjectDir}/uploads`,
    );
    const uploadsPrefix = `${uploadsObjectName}/`;
    const [files] = await objectStorageClient.bucket(bucketName).getFiles({
      prefix: uploadsPrefix,
    });
    const staleFiles = files.filter((file) => {
      const entityPath = file.name.slice(uploadsPrefix.length);
      const objectPath = `/objects/uploads/${entityPath}`;
      const timeCreated = file.metadata.timeCreated
        ? Date.parse(file.metadata.timeCreated)
        : Number.NaN;

      // Missing creation metadata is handled conservatively: leave the object
      // in place rather than risk deleting a recently uploaded proof.
      return (
        file.name.startsWith(uploadsPrefix) &&
        isPaymentProofUploadObjectName(`uploads/${entityPath}`) &&
        !referencedObjectPaths.has(objectPath) &&
        Number.isFinite(timeCreated) &&
        timeCreated < olderThan.getTime()
      );
    });
    const failedObjectPaths: string[] = [];
    let deleted = 0;

    for (const file of staleFiles) {
      const objectPath = `/objects/uploads/${file.name.slice(uploadsPrefix.length)}`;
      try {
        await file.delete();
        deleted += 1;
      } catch {
        failedObjectPaths.push(objectPath);
      }
    }

    return {
      scanned: staleFiles.length,
      deleted,
      failedObjectPaths,
    };
  }

  async markObjectPrivate(
    objectPath: string,
    owner: string,
  ): Promise<void> {
    const objectFile = await this.getObjectEntityFile(objectPath);
    const policy: ObjectAclPolicy = { owner, visibility: "private" };
    await setObjectAclPolicy(objectFile, policy);
  }

  async createPrivateImage(objectPath: string, data: Buffer, owner: string, metadata: Record<string, string>): Promise<void> {
    if (!/^\/objects\/(?:listing-image(?:s|s-thumbnails)|banners)\/[0-9a-f-]{36}$/i.test(objectPath)) {
      throw new Error("Invalid generated image path");
    }
    const { bucketName, objectName } = parseObjectPath(
      `${this.getPrivateObjectDir()}/${objectPath.slice("/objects/".length)}`,
    );
    await objectStorageClient.bucket(bucketName).file(objectName).save(data, {
      resumable: false,
      preconditionOpts: { ifGenerationMatch: 0 },
      metadata: {
        contentType: "image/webp",
        metadata: { ...metadata, "custom:aclPolicy": JSON.stringify({ owner, visibility: "private" }) },
      },
    });
  }

  async downloadObject(file: File): Promise<Response> {
    const [metadata] = await file.getMetadata();
    const nodeStream = file.createReadStream();
    const webStream = Readable.toWeb(nodeStream) as ReadableStream;
    const headers: Record<string, string> = {
      "Content-Type": (metadata.contentType as string) || "application/octet-stream",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    };
    if (metadata.size) headers["Content-Length"] = String(metadata.size);
    return new Response(webStream, { headers });
  }
}

function normalizeManagedObjectPath(value: string): string | null {
  if (typeof value !== "string") return null;
  const path = value.startsWith("https://storage.googleapis.com/")
    ? value
    : value;
  if (path.startsWith("https://storage.googleapis.com/")) return null;
  if (
    /^\/objects\/listing-images\/[0-9a-f-]{36}$/i.test(path) ||
    /^\/objects\/listing-images-thumbnails\/[0-9a-f-]{36}$/i.test(path) ||
    /^\/objects\/banners\/[0-9a-f-]{36}$/i.test(path) ||
    /^\/objects\/banner-image-inputs\/[0-9a-f-]{36}$/i.test(path) ||
    /^\/objects\/listing-image-inputs\/[0-9a-f]{32}-[0-9a-f-]{36}$/i.test(path) ||
    isPaymentProofObjectPath(path)
  ) {
    return path;
  }
  return null;
}

export function isProductionObjectStorageConfigured(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  return Boolean(
    process.env.PRIVATE_OBJECT_DIR?.trim()
      && process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID?.trim(),
  );
}

function parseObjectPath(path: string): {
  bucketName: string;
  objectName: string;
} {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const parts = normalized.split("/");
  if (parts.length < 3 || !parts[1] || !parts.slice(2).join("/")) {
    throw new Error("Invalid object storage path");
  }
  return { bucketName: parts[1], objectName: parts.slice(2).join("/") };
}

async function signObjectURL({
  bucketName,
  objectName,
  method,
  ttlSec,
}: {
  bucketName: string;
  objectName: string;
  method: "GET" | "PUT";
  ttlSec: number;
}): Promise<string> {
  const response = await fetch(
    `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bucket_name: bucketName,
        object_name: objectName,
        method,
        expires_at: new Date(Date.now() + ttlSec * 1000).toISOString(),
      }),
      signal: AbortSignal.timeout(30_000),
    },
  );
  if (!response.ok) {
    throw new Error(`Failed to sign object URL, errorcode: ${response.status}`);
  }
  const body = (await response.json()) as { signed_url?: string };
  if (!body.signed_url) throw new Error("Object storage returned no signed URL");
  return body.signed_url;
}