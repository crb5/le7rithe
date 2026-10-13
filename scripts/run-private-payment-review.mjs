import { spawn } from "node:child_process";

const privateObjectDir = process.env.PRIVATE_OBJECT_DIR?.trim();
const baseURL = (
  process.env.E2E_BASE_URL ?? process.env.REPLIT_DEV_DOMAIN
)?.trim();
const forceFailure = process.env.PRIVATE_PAYMENT_REVIEW_FORCE_FAILURE === "1";

function fail(message) {
  console.error(`Private payment review validation failed: ${message}`);
  process.exit(1);
}

function redact(text) {
  const withoutPrivateObjectDir = privateObjectDir
    ? text.replaceAll(privateObjectDir, "[redacted-private-object-dir]")
    : text;
  return withoutPrivateObjectDir
    .replace(/\b(?:https?|gs):\/\/[^\s"'`<>]+/gi, "[redacted-url]")
    .replace(
      /(?:signedUrl|signature|x-goog-signature|sig)=[^&\s]+/gi,
      (match) => `${match.slice(0, match.indexOf("="))}=[redacted]`,
    );
}

if (forceFailure) {
  fail("forced release-gate failure");
} else if (!privateObjectDir) {
  fail(
    "PRIVATE_OBJECT_DIR is not configured for the provisioned private App Storage bucket",
  );
} else if (
  !/^\/[^/]+\/private(?:\/|$)/i.test(privateObjectDir) ||
  /^(?:https?:|gs:)/i.test(privateObjectDir)
) {
  fail("PRIVATE_OBJECT_DIR is not a private App Storage path");
} else if (!baseURL) {
  fail("E2E_BASE_URL or REPLIT_DEV_DOMAIN is not configured");
}

const forwardedArgs = process.argv.slice(2);
if (forwardedArgs[0] === "--") forwardedArgs.shift();

const child = spawn(
  "pnpm",
  [
    "exec",
    "playwright",
    "test",
    "--config=e2e/playwright.config.ts",
    "--project=payment-review",
    ...forwardedArgs,
  ],
  {
    env: {
      ...process.env,
      E2E_PAYMENT_PROOF_STORAGE: "private",
    },
    stdio: ["inherit", "pipe", "pipe"],
  },
);

let output = "";
const capture = (chunk) => {
  output += String(chunk);
  if (output.length > 32_000) output = output.slice(-32_000);
};

child.stdout.on("data", capture);
child.stderr.on("data", capture);

child.on("error", (error) => {
  fail(`could not start browser validation (${error.message})`);
});

child.on("exit", (code, signal) => {
  if (signal) {
    fail(`browser validation stopped by ${signal}`);
  } else if (code === 0) {
    console.log("Private payment review validation passed.");
  } else {
    const details = redact(output)
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(-5)
      .join(" | ");
    fail(
      details
        ? `browser validation failed (exit code ${code ?? 1}): ${details}`
        : `browser validation failed (exit code ${code ?? 1})`,
    );
  }
});
