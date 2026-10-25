#!/usr/bin/env node
/**
 * Run this ON THE NEW SERVER (or anywhere with network access to the
 * production Postgres and a copy of the object storage directory).
 *
 * Cross-checks every image reference in the database (listing photos,
 * listing thumbnails, banners, payment proofs) against the actual files
 * under OBJECT_STORAGE_DIR and reports anything missing. This is the
 * concrete "did every old image actually make it over" check.
 *
 * Usage:
 *   DATABASE_URL=postgresql://... OBJECT_STORAGE_DIR=/data/objects node verify-object-storage.mjs
 */
import { access } from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL;
const storageDir = process.env.OBJECT_STORAGE_DIR;

if (!databaseUrl) {
  console.error("Set DATABASE_URL.");
  process.exit(1);
}
if (!storageDir) {
  console.error("Set OBJECT_STORAGE_DIR (same value the app uses).");
  process.exit(1);
}

const storageRoot = path.resolve(storageDir);

/** Maps a stored `/objects/<entityId>` reference to its local blob path, or
 *  null if the value isn't one of our canonical object paths (e.g. a seed
 *  Unsplash URL, or legacy non-canonical data worth flagging separately). */
function canonicalBlobPath(value) {
  if (!value || !value.startsWith("/objects/")) return null;
  const entityId = value.slice("/objects/".length);
  if (!entityId || entityId.includes("..")) return null;
  return path.join(storageRoot, entityId);
}

async function fileExists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function checkColumn({ client, label, sql, extractRefs }) {
  const { rows } = await client.query(sql);
  let total = 0;
  let missing = 0;
  let nonCanonical = 0;
  const missingDetails = [];
  const nonCanonicalDetails = [];

  for (const row of rows) {
    for (const ref of extractRefs(row)) {
      if (!ref) continue;
      total++;
      const blobPath = canonicalBlobPath(ref);
      if (!blobPath) {
        nonCanonical++;
        if (nonCanonicalDetails.length < 20) nonCanonicalDetails.push({ id: row.id, ref });
        continue;
      }
      if (!(await fileExists(blobPath))) {
        missing++;
        if (missingDetails.length < 20) missingDetails.push({ id: row.id, ref, blobPath });
      }
    }
  }

  console.log(`\n${label}`);
  console.log(`  references checked: ${total}`);
  console.log(`  missing on disk:    ${missing}`);
  console.log(`  non-canonical (external/legacy URL, skipped file check): ${nonCanonical}`);
  if (missingDetails.length > 0) {
    console.log(`  first ${missingDetails.length} missing:`);
    for (const d of missingDetails) console.log(`    id=${d.id}  ${d.ref}`);
  }
  if (nonCanonicalDetails.length > 0) {
    console.log(`  first ${nonCanonicalDetails.length} non-canonical:`);
    for (const d of nonCanonicalDetails) console.log(`    id=${d.id}  ${d.ref}`);
  }
  return { total, missing, nonCanonical };
}

async function main() {
  console.log(`Object storage root: ${storageRoot}`);
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();

  const results = [];
  results.push(
    await checkColumn({
      client,
      label: "Listings — imageUrl + images[]",
      sql: `select id, image_url, images from marketplace_listings`,
      extractRefs: (row) => [row.image_url, ...(row.images ?? [])],
    }),
  );
  results.push(
    await checkColumn({
      client,
      label: "Banners — imagePath",
      sql: `select id, image_path from marketplace_banners`,
      extractRefs: (row) => [row.image_path],
    }),
  );
  results.push(
    await checkColumn({
      client,
      label: "Payments — proofImageUrl",
      sql: `select id, proof_image_url from marketplace_payments`,
      extractRefs: (row) => [row.proof_image_url],
    }),
  );

  await client.end();

  const totalMissing = results.reduce((sum, r) => sum + r.missing, 0);
  console.log(`\n${"=".repeat(40)}`);
  if (totalMissing === 0) {
    console.log("All canonical image references resolve to a file on disk. ✓");
  } else {
    console.log(`${totalMissing} image reference(s) point to missing files — fix before cutover.`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("Verification failed:", error);
  process.exit(1);
});
