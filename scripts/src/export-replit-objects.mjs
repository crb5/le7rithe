#!/usr/bin/env node
/**
 * Run this ON REPLIT (in the original project's shell), not on the new server.
 *
 * It downloads every object under PRIVATE_OBJECT_DIR from Replit's App
 * Storage (GCS-backed, via the Replit sidecar credential exchange used by
 * the old artifacts/api-server/src/lib/objectStorage.ts) into a local
 * ./object-export folder, writing each blob plus a `<blob>.meta.json`
 * sidecar in the EXACT format the new local-filesystem object storage
 * (OBJECT_STORAGE_DIR) expects. The export folder's contents can then be
 * copied directly into the new server's object storage volume with no
 * further transformation.
 *
 * Usage (on Replit):
 *   npm install @google-cloud/storage
 *   node export-replit-objects.mjs
 *
 * Then transfer ./object-export to the new server, e.g.:
 *   tar -czf object-export.tar.gz object-export
 *   # scp/rsync object-export.tar.gz to the server, then on the server:
 *   tar -xzf object-export.tar.gz
 *   cp -rn object-export/* /path/to/app-objects-volume/
 *   # -n = never overwrite existing files, safe to re-run
 */
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Storage } from "@google-cloud/storage";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

const privateObjectDir = (process.env.PRIVATE_OBJECT_DIR || "").trim();
if (!privateObjectDir) {
  console.error(
    "PRIVATE_OBJECT_DIR is not set. Run this inside the original Replit project's shell, " +
      "where this env var still points at the App Storage bucket path.",
  );
  process.exit(1);
}

const outDir = path.resolve(process.cwd(), "object-export");

const storageClient = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: { type: "json", subject_token_field_name: "access_token" },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

function parseBucketAndPrefix(objectDir) {
  // objectDir looks like "/<bucket-name>/.private" (leading slash, bucket is first segment).
  const trimmed = objectDir.replace(/^\/+/, "").replace(/\/+$/, "");
  const [bucketName, ...rest] = trimmed.split("/");
  return { bucketName, prefix: rest.join("/") };
}

async function main() {
  const { bucketName, prefix } = parseBucketAndPrefix(privateObjectDir);
  if (!bucketName) {
    console.error(`Could not parse a bucket name out of PRIVATE_OBJECT_DIR="${privateObjectDir}"`);
    process.exit(1);
  }
  console.log(`Bucket: ${bucketName}`);
  console.log(`Prefix: ${prefix || "(root)"}`);
  console.log(`Writing to: ${outDir}\n`);

  const bucket = storageClient.bucket(bucketName);
  const gcsPrefix = prefix ? `${prefix}/` : "";
  const [files] = await bucket.getFiles({ prefix: gcsPrefix });

  if (files.length === 0) {
    console.warn("No objects found under that prefix. Double-check PRIVATE_OBJECT_DIR.");
    return;
  }

  let ok = 0;
  let failed = 0;
  const errors = [];

  for (const file of files) {
    // Relative key after the PRIVATE_OBJECT_DIR prefix, e.g. "listing-images/<uuid>",
    // "uploads/<uuid>", "banners/<uuid>" — this matches the `/objects/<entityId>`
    // scheme the app already uses, so it needs no rewriting on import.
    const relativeKey = file.name.slice(gcsPrefix.length);
    if (!relativeKey) continue;

    try {
      const [buffer] = await file.download();
      const [gcsMeta] = await file.getMetadata();

      const blobPath = path.join(outDir, relativeKey);
      await mkdir(path.dirname(blobPath), { recursive: true });
      await writeFile(blobPath, buffer);

      const sidecar = {
        contentType: gcsMeta.contentType,
        size: buffer.byteLength,
        generation: 1,
        timeCreated: gcsMeta.timeCreated ?? new Date().toISOString(),
        md5Hash: createHash("md5").update(buffer).digest("base64"),
        // Carries over the real ACL policy (custom:aclPolicy) and any other
        // custom metadata GCS already had on the object, unchanged.
        metadata: gcsMeta.metadata ?? {},
      };
      await writeFile(`${blobPath}.meta.json`, JSON.stringify(sidecar));

      ok++;
      if (ok % 50 === 0) console.log(`  ...${ok} objects exported`);
    } catch (error) {
      failed++;
      errors.push({ name: file.name, error: String(error?.message ?? error) });
    }
  }

  console.log(`\nDone. Exported ${ok} object(s), ${failed} failure(s).`);
  if (errors.length > 0) {
    const errorLog = path.join(outDir, "_export-errors.json");
    await writeFile(errorLog, JSON.stringify(errors, null, 2));
    console.warn(`Some objects failed — see ${errorLog}`);
  }
}

main().catch((error) => {
  console.error("Export failed:", error);
  process.exit(1);
});
