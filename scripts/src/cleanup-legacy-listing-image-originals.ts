import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const args = new Set(process.argv.slice(2));
const usage = [
  "Dry run (default): NODE_ENV=development pnpm --filter @workspace/scripts cleanup:legacy-listing-image-originals",
  "Apply: NODE_ENV=development pnpm --filter @workspace/scripts cleanup:legacy-listing-image-originals -- --apply --backup-confirmed",
  "Only apply after independently confirming a restorable backup of the development bucket exists.",
].join("\n");

if (args.has("--help")) {
  console.log(usage);
} else {
  const apply = args.has("--apply");
  const backupConfirmed = args.has("--backup-confirmed");
  const unknownArgs = [...args].filter((arg) => arg !== "--apply" && arg !== "--backup-confirmed");

  if (unknownArgs.length) {
    throw new Error(`Unknown option: ${unknownArgs[0]}\n${usage}`);
  }
  if (process.env.NODE_ENV !== "development" || process.env.REPLIT_DEPLOYMENT) {
    throw new Error("Legacy image cleanup is restricted to a non-deployment development process.");
  }
  if (apply && !backupConfirmed) {
    throw new Error(`Apply requires --backup-confirmed after verifying a restorable backup.\n${usage}`);
  }

  const olderThan = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const storageModuleUrl = pathToFileURL(resolve(
    process.cwd(),
    "../artifacts/api-server/src/lib/objectStorage.ts",
  ));
  const { ObjectStorageService } = await import(storageModuleUrl.href);
  const result = await new ObjectStorageService().cleanupLegacyListingImageInputs({
    apply,
    olderThan,
  });

  if (result.alreadyCompleted) {
    console.log("The one-time legacy listing-image cleanup has already completed.");
  } else {
    console.log(JSON.stringify({
      mode: apply ? "apply" : "dry-run",
      olderThan: olderThan.toISOString(),
      scanned: result.scanned,
      eligible: result.eligible,
      deleted: result.deleted,
      failed: result.failed,
    }, null, 2));
  }

  if (result.failed > 0) process.exitCode = 1;
}
