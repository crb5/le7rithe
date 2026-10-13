import { test as setup } from "@playwright/test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";

const execFileAsync = promisify(execFile);

setup("provision fresh Clerk sessions", async () => {
  try {
    await execFileAsync("yarn", ["run", "validate:development-schema"], {
      env: process.env,
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch (error) {
    const details =
      error && typeof error === "object" && "stderr" in error && error.stderr
        ? String(error.stderr).trim()
        : error instanceof Error
          ? error.message
          : String(error);
    throw new Error(
      `Development schema validation failed before payment-review authentication setup. ${details}`,
      { cause: error },
    );
  }

  try {
    await execFileAsync(
      process.execPath,
      [resolve(process.cwd(), "e2e/setup-auth.mjs")],
      {
        env: process.env,
        maxBuffer: 10 * 1024 * 1024,
      },
    );
  } catch (error) {
    const details =
      error && typeof error === "object" && "stderr" in error && error.stderr
        ? String(error.stderr).trim()
        : error instanceof Error
          ? error.message
          : String(error);
    throw new Error(
      `Payment review authentication setup failed before the queue test could start. ${details}`,
      { cause: error },
    );
  }
});
