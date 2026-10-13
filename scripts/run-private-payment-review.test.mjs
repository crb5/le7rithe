import assert from "node:assert/strict";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const runnerPath = join(repoRoot, "scripts/run-private-payment-review.mjs");

const runRunner = (environment) =>
  new Promise((resolveResult, reject) => {
    const child = spawn(process.execPath, [runnerPath], {
      cwd: repoRoot,
      env: environment,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code, signal) => {
      resolveResult({
        code,
        signal,
        output: `${stdout}${stderr}`,
      });
    });
  });

const environmentWith = (changes) => {
  const environment = { ...process.env };
  for (const [key, value] of Object.entries(changes)) {
    if (value === undefined) {
      delete environment[key];
    } else {
      environment[key] = value;
    }
  }
  return environment;
};

const assertNoSensitiveReceiptDetails = (
  output,
  privateObjectDir,
  signedURL,
) => {
  assert.equal(
    output.includes(privateObjectDir),
    false,
    "captured output must not contain the private object path",
  );
  assert.equal(
    output.includes(signedURL),
    false,
    "captured output must not contain the signed upload URL",
  );
  assert.doesNotMatch(
    output,
    /https?:\/\/[^\s"'`<>]+/i,
    "captured output must not contain a URL",
  );
  assert.doesNotMatch(
    output,
    /(?:signedUrl|signature|x-goog-signature|sig)=[^&\s]+/i,
    "captured output must not contain a signing parameter",
  );
};

test("reports missing private bucket configuration without receipt details", async () => {
  const result = await runRunner(
    environmentWith({
      PRIVATE_OBJECT_DIR: undefined,
      E2E_BASE_URL: "https://preview.example",
      PRIVATE_PAYMENT_REVIEW_FORCE_FAILURE: undefined,
    }),
  );

  assert.equal(result.code, 1);
  assert.equal(result.signal, null);
  assert.match(result.output, /PRIVATE_OBJECT_DIR is not configured/);
  assertNoSensitiveReceiptDetails(
    result.output,
    "/receipt-proof-bucket/private",
    "https://storage.example/receipt-proof-bucket/private/receipt.png?sig=secret",
  );
});

test("redacts receipt details from child validation failures", async () => {
  const privateObjectDir = "/receipt-proof-bucket/private";
  const privateObjectPath = `${privateObjectDir}/payments/receipt.png`;
  const signedURL =
    "https://storage.example/receipt-proof-bucket/private/payments/receipt.png" +
    "?X-Goog-Signature=secret-signature&X-Goog-Credential=secret-credential";
  const temporaryDirectory = await mkdtemp(
    join(tmpdir(), "private-payment-review-test-"),
  );
  const fakeYarnPath = join(temporaryDirectory, "yarn");

  try {
    await writeFile(
      fakeYarnPath,
      `#!/bin/sh
printf '%s\\n' 'child validation failed for ${privateObjectPath}' >&2
printf '%s\\n' 'upload URL: ${signedURL}' >&2
exit 7
`,
    );
    await chmod(fakeYarnPath, 0o755);

    const result = await runRunner(
      environmentWith({
        PRIVATE_OBJECT_DIR: privateObjectDir,
        E2E_BASE_URL: "https://preview.example",
        PRIVATE_PAYMENT_REVIEW_FORCE_FAILURE: undefined,
        PATH: `${temporaryDirectory}:${process.env.PATH ?? ""}`,
      }),
    );

    assert.equal(result.code, 1);
    assert.equal(result.signal, null);
    assert.match(result.output, /browser validation failed \(exit code 7\)/);
    assertNoSensitiveReceiptDetails(result.output, privateObjectDir, signedURL);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});
