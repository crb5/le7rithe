import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { createReadStream, promises as fsp } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
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

/**
 * Local-filesystem object storage.
 *
 * Replaces the former Replit/GCS sidecar. Objects live under
 * `OBJECT_STORAGE_DIR`, one blob file per object plus a `<blob>.meta.json`
 * sidecar holding content type, ACL policy, a monotonic generation counter and
 * the creation timestamp. Uploads use short-lived HMAC-signed URLs (keyed by
 * `SESSION_SECRET`) pointing at `PUT /api/objects/upload/:token`; reads are
 * streamed back through the existing API routes. The public method surface is
 * unchanged from the previous GCS-backed implementation, so route handlers did
 * not have to change.
 */

const UPLOAD_TOKEN_TTL_SEC = 900;
/** Hard cap for a single raw upload. Downstream processing enforces real limits. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

/** Precondition failure analogous to a GCS ifGenerationMatch mismatch. */
export class ObjectPreconditionError extends Error {
  constructor() {
    super("Object generation precondition failed");
    this.name = "ObjectPreconditionError";
    Object.setPrototypeOf(this, ObjectPreconditionError.prototype);
  }
}

export type StoredMetadata = {
  contentType?: string;
  size?: number;
  generation?: number;
  timeCreated?: string;
  md5Hash?: string;
  metadata?: Record<string, string>;
};

type SaveOptions = {
  resumable?: boolean;
  preconditionOpts?: { ifGenerationMatch?: number };
  metadata?: { contentType?: string; metadata?: Record<string, string> };
};

function storageRoot(): string {
  const dir = process.env.OBJECT_STORAGE_DIR;
  if (!dir || !dir.trim()) {
    throw new Error(
      "OBJECT_STORAGE_DIR is not set. Point it at a writable directory for uploaded objects.",
    );
  }
  return path.resolve(dir.trim());
}

/** Rejects object names that escape the storage root or contain unsafe segments. */
function resolveWithinRoot(root: string, objectName: string): string {
  const full = path.resolve(root, objectName);
  const rel = path.relative(root, full);
  if (rel === "" || rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error("Invalid object storage path");
  }
  return full;
}

/** A disk-backed object exposing the subset of the former GCS `File` API in use. */
export class StoredFile {
  readonly name: string;
  metadata: StoredMetadata = {};
  private readonly root: string;

  constructor(root: string, name: string) {
    this.root = root;
    this.name = name;
  }

  private blobPath(): string {
    return resolveWithinRoot(this.root, this.name);
  }

  private metaPath(): string {
    return `${this.blobPath()}.meta.json`;
  }

  async exists(): Promise<[boolean]> {
    try {
      await fsp.access(this.blobPath());
      return [true];
    } catch {
      return [false];
    }
  }

  async loadMetadata(): Promise<StoredMetadata> {
    let meta: StoredMetadata = {};
    try {
      meta = JSON.parse(await fsp.readFile(this.metaPath(), "utf8")) as StoredMetadata;
    } catch {
      meta = {};
    }
    try {
      const stat = await fsp.stat(this.blobPath());
      meta.size = stat.size;
      if (!meta.timeCreated) meta.timeCreated = stat.birthtime.toISOString();
    } catch {
      // Blob missing; leave size/timeCreated as stored (if any).
    }
    this.metadata = meta;
    return meta;
  }

  async getMetadata(): Promise<[StoredMetadata]> {
    return [await this.loadMetadata()];
  }

  async setMetadata(update: { metadata?: Record<string, string> }): Promise<void> {
    const current = await this.loadMetadata();
    const next: StoredMetadata = {
      ...current,
      metadata: { ...(current.metadata ?? {}), ...(update.metadata ?? {}) },
    };
    await fsp.writeFile(this.metaPath(), JSON.stringify(next), "utf8");
    this.metadata = next;
  }

  createReadStream(): Readable {
    return createReadStream(this.blobPath());
  }

  async download(): Promise<[Buffer]> {
    try {
      return [await fsp.readFile(this.blobPath())];
    } catch {
      throw new ObjectNotFoundError();
    }
  }

  async save(data: Buffer, options: SaveOptions = {}): Promise<void> {
    const current = await this.loadMetadata();
    const [exists] = await this.exists();
    const expected = options.preconditionOpts?.ifGenerationMatch;
    if (expected === 0 && exists) throw new ObjectPreconditionError();
    if (typeof expected === "number" && expected > 0 && current.generation !== expected) {
      throw new ObjectPreconditionError();
    }
    const blobPath = this.blobPath();
    await fsp.mkdir(path.dirname(blobPath), { recursive: true });
    await fsp.writeFile(blobPath, data);
    const next: StoredMetadata = {
      contentType: options.metadata?.contentType ?? current.contentType,
      size: data.byteLength,
      generation: (current.generation ?? 0) + 1,
      timeCreated: current.timeCreated ?? new Date().toISOString(),
      md5Hash: createHash("md5").update(data).digest("base64"),
      metadata: options.metadata?.metadata ?? current.metadata ?? {},
    };
    await fsp.writeFile(this.metaPath(), JSON.stringify(next), "utf8");
    this.metadata = next;
  }

  async delete(options: { ignoreNotFound?: boolean } = {}): Promise<void> {
    const remove = async (target: string) => {
      try {
        await fsp.unlink(target);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          if (!options.ignoreNotFound && target === this.blobPath()) {
            throw new ObjectNotFoundError();
          }
          return;
        }
        throw error;
      }
    };
    await remove(this.blobPath());
    await remove(this.metaPath());
  }
}

function uploadSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is required to sign upload URLs.");
  return secret;
}

function signUploadToken(objectName: string, ttlSec = UPLOAD_TOKEN_TTL_SEC): string {
  const expires = Date.now() + ttlSec * 1000;
  const payload = `${Buffer.from(objectName).toString("base64url")}.${expires}`;
  const mac = createHmac("sha256", uploadSecret()).update(payload).digest("base64url");
  return `${payload}.${mac}`;
}

/** Verifies an upload token and returns the target object name, or null. */
export function verifyUploadToken(token: string): { objectName: string } | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [encodedName, expiresRaw, mac] = parts;
  const payload = `${encodedName}.${expiresRaw}`;
  const expectedMac = createHmac("sha256", uploadSecret()).update(payload).digest("base64url");
  const given = Buffer.from(mac);
  const expected = Buffer.from(expectedMac);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  const expires = Number(expiresRaw);
  if (!Number.isFinite(expires) || Date.now() > expires) return null;
  try {
    const objectName = Buffer.from(encodedName, "base64url").toString("utf8");
    if (!/^[a-z0-9._/-]+$/i.test(objectName) || objectName.includes("..")) return null;
    return { objectName };
  } catch {
    return null;
  }
}

export class ObjectStorageService {
  getPrivateObjectDir(): string {
    return storageRoot();
  }

  async getObjectEntityUploadURL(
    prefix = "uploads",
    objectId: string = randomUUID(),
  ): Promise<string> {
    if (!/^[a-z0-9-]+$/i.test(prefix) || !/^[a-z0-9._-]+$/i.test(objectId)) {
      throw new Error("Invalid object storage upload prefix");
    }
    return `/api/objects/upload/${signUploadToken(`${prefix}/${objectId}`)}`;
  }

  /**
   * Writes a client upload authorized by a signed token (the `PUT
   * /api/objects/upload/:token` handler). Returns the stored `/objects/...`
   * path, or null when the token is invalid or expired.
   */
  async completeUpload(
    token: string,
    data: Buffer,
    contentType: string | undefined,
  ): Promise<string | null> {
    const verified = verifyUploadToken(token);
    if (!verified) return null;
    const file = new StoredFile(storageRoot(), verified.objectName);
    await file.save(data, {
      resumable: false,
      metadata: { contentType: contentType || "application/octet-stream" },
    });
    return `/objects/${verified.objectName}`;
  }

  normalizeObjectEntityPath(rawPath: string): string {
    const uploadPrefix = "/api/objects/upload/";
    if (rawPath.startsWith(uploadPrefix)) {
      const verified = verifyUploadToken(rawPath.slice(uploadPrefix.length));
      if (verified) return `/objects/${verified.objectName}`;
      return rawPath;
    }
    return rawPath;
  }

  async getObjectEntityFile(objectPath: string): Promise<StoredFile> {
    if (!objectPath.startsWith("/objects/")) throw new ObjectNotFoundError();
    const entityId = objectPath.slice("/objects/".length);
    if (!entityId) throw new ObjectNotFoundError();
    const file = new StoredFile(storageRoot(), entityId);
    const [exists] = await file.exists();
    if (!exists) throw new ObjectNotFoundError();
    await file.loadMetadata();
    return file;
  }

  async deleteObjectIfExists(objectPath: string): Promise<void> {
    const safeObjectPath = normalizeManagedObjectPath(objectPath);
    if (!safeObjectPath) throw new Error("Invalid private object path");
    const entityId = safeObjectPath.slice("/objects/".length);
    await new StoredFile(storageRoot(), entityId).delete({ ignoreNotFound: true });
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
    const root = storageRoot();
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

    const inputPrefix = `listing-image-inputs/${listingImageInputId(owner, "")}`;
    for (const file of await listFiles(root, inputPrefix)) {
      const objectPath = `/objects/${file.name}`;
      if (isOwnedListingImageInput(objectPath, owner)) addPath(objectPath);
    }

    for (const prefix of ["listing-images", "listing-images-thumbnails"]) {
      for (const file of await listFiles(root, `${prefix}/`)) {
        const imageId = file.name.slice(`${prefix}/`.length);
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

    for (const file of await listFiles(root, "uploads/")) {
      const objectPath = `/objects/${file.name}`;
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
    const root = storageRoot();
    const markerFile = new StoredFile(root, "system/privacy-cleanups/listing-image-originals-v1.complete");
    const [alreadyCompleted] = await markerFile.exists();
    if (alreadyCompleted) {
      return { alreadyCompleted: true, scanned: 0, eligible: 0, deleted: 0, failed: 0 };
    }

    const files = await listFiles(root, "listing-image-inputs/");
    const inputPrefixLength = "listing-image-inputs/".length;
    const eligibleFiles = files.filter((file) => {
      const id = file.name.slice(inputPrefixLength);
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
      return { alreadyCompleted: false, scanned: files.length, eligible: eligibleFiles.length, deleted: 0, failed: 0 };
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
      await markerFile.save(Buffer.from(JSON.stringify({
        completedAt: new Date().toISOString(),
        scanned: files.length,
        eligible: eligibleFiles.length,
        deleted,
      })), {
        resumable: false,
        preconditionOpts: { ifGenerationMatch: 0 },
        metadata: { contentType: "application/json" },
      });
    }

    return { alreadyCompleted: false, scanned: files.length, eligible: eligibleFiles.length, deleted, failed };
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
    const root = storageRoot();
    const files = await listFiles(root, "uploads/");
    const staleFiles = files.filter((file) => {
      const entityPath = file.name.slice("uploads/".length);
      const objectPath = `/objects/uploads/${entityPath}`;
      const timeCreated = file.metadata.timeCreated
        ? Date.parse(file.metadata.timeCreated)
        : Number.NaN;
      // Missing creation metadata is handled conservatively: leave the object
      // in place rather than risk deleting a recently uploaded proof.
      return (
        isPaymentProofUploadObjectName(`uploads/${entityPath}`) &&
        !referencedObjectPaths.has(objectPath) &&
        Number.isFinite(timeCreated) &&
        timeCreated < olderThan.getTime()
      );
    });
    const failedObjectPaths: string[] = [];
    let deleted = 0;

    for (const file of staleFiles) {
      const objectPath = `/objects/uploads/${file.name.slice("uploads/".length)}`;
      try {
        await file.delete();
        deleted += 1;
      } catch {
        failedObjectPaths.push(objectPath);
      }
    }

    return { scanned: staleFiles.length, deleted, failedObjectPaths };
  }

  async markObjectPrivate(objectPath: string, owner: string): Promise<void> {
    const objectFile = await this.getObjectEntityFile(objectPath);
    const policy: ObjectAclPolicy = { owner, visibility: "private" };
    await setObjectAclPolicy(objectFile, policy);
  }

  async createPrivateImage(
    objectPath: string,
    data: Buffer,
    owner: string,
    metadata: Record<string, string>,
  ): Promise<void> {
    if (!/^\/objects\/(?:listing-image(?:s|s-thumbnails)|banners)\/[0-9a-f-]{36}$/i.test(objectPath)) {
      throw new Error("Invalid generated image path");
    }
    const entityId = objectPath.slice("/objects/".length);
    await new StoredFile(storageRoot(), entityId).save(data, {
      resumable: false,
      preconditionOpts: { ifGenerationMatch: 0 },
      metadata: {
        contentType: "image/webp",
        metadata: { ...metadata, "custom:aclPolicy": JSON.stringify({ owner, visibility: "private" }) },
      },
    });
  }

  async downloadObject(file: StoredFile): Promise<Response> {
    const [metadata] = await file.getMetadata();
    const webStream = Readable.toWeb(file.createReadStream()) as ReadableStream;
    const headers: Record<string, string> = {
      "Content-Type": metadata.contentType || "application/octet-stream",
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
  if (
    /^\/objects\/listing-images\/[0-9a-f-]{36}$/i.test(value) ||
    /^\/objects\/listing-images-thumbnails\/[0-9a-f-]{36}$/i.test(value) ||
    /^\/objects\/banners\/[0-9a-f-]{36}$/i.test(value) ||
    /^\/objects\/banner-image-inputs\/[0-9a-f-]{36}$/i.test(value) ||
    /^\/objects\/listing-image-inputs\/[0-9a-f]{32}-[0-9a-f-]{36}$/i.test(value) ||
    isPaymentProofObjectPath(value)
  ) {
    return value;
  }
  return null;
}

export function isProductionObjectStorageConfigured(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  return Boolean(process.env.OBJECT_STORAGE_DIR?.trim());
}

/**
 * Returns stored objects whose name begins with `prefix` (a name-relative
 * prefix such as `uploads/` or `listing-images/`), with metadata preloaded.
 * `.meta.json` sidecars are excluded.
 */
async function listFiles(root: string, prefix: string): Promise<StoredFile[]> {
  const files: StoredFile[] = [];
  const walk = async (dir: string): Promise<void> => {
    let entries;
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(abs);
        continue;
      }
      if (entry.name.endsWith(".meta.json")) continue;
      const name = path.relative(root, abs).split(path.sep).join("/");
      if (!name.startsWith(prefix)) continue;
      const file = new StoredFile(root, name);
      await file.loadMetadata();
      files.push(file);
    }
  };
  await walk(root);
  return files;
}
