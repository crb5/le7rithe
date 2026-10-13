import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  checkMoorsylVerification,
  MoorsylVerificationError,
  sendMoorsylVerification,
} from "./moorsyl-verify";

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("Moorsyl Verify client", () => {
  it("sends a canonical phone number with the server-only publishable key", async () => {
    const previousKey = process.env.MOORSYL_PUBLISHABLE_KEY;
    process.env.MOORSYL_PUBLISHABLE_KEY = "pk_test_unit_test";
    let requestUrl = "";
    let requestHeaders: Headers | undefined;
    let requestBody = "";
    try {
      const verificationId = await sendMoorsylVerification("+22236123456", async (input, init) => {
        requestUrl = String(input);
        requestHeaders = new Headers(init?.headers);
        requestBody = String(init?.body);
        return jsonResponse({ verificationId: "ver_test_1" });
      });

      assert.equal(verificationId, "ver_test_1");
      assert.equal(requestUrl, "https://api.moorsyl.com/api/verify/send");
      assert.equal(requestHeaders?.get("x-api-key"), "pk_test_unit_test");
      assert.deepEqual(JSON.parse(requestBody), { to: "+22236123456" });
    } finally {
      if (previousKey === undefined) delete process.env.MOORSYL_PUBLISHABLE_KEY;
      else process.env.MOORSYL_PUBLISHABLE_KEY = previousKey;
    }
  });

  it("logs the provider HTTP status and response body while redacting sensitive values", async () => {
    const previousKey = process.env.MOORSYL_PUBLISHABLE_KEY;
    process.env.MOORSYL_PUBLISHABLE_KEY = "pk_test_unit_test";
    const logEntries: Array<{ operation: string; httpStatus: number; responseBody: string }> = [];
    try {
      await assert.rejects(
        sendMoorsylVerification(
          "+22236123456",
          async () => jsonResponse({
            error: "Invalid phone +22236123456",
            to: "+22236123456",
            verificationId: "ver_private_1",
          }, 400),
          (entry) => logEntries.push(entry),
        ),
        (error: unknown) => error instanceof MoorsylVerificationError && error.kind === "invalid_phone",
      );

      assert.deepEqual(logEntries, [{
        operation: "send",
        httpStatus: 400,
        responseBody: JSON.stringify({
          error: "Invalid phone [REDACTED_PHONE]",
          to: "[REDACTED]",
          verificationId: "[REDACTED]",
        }),
      }]);
    } finally {
      if (previousKey === undefined) delete process.env.MOORSYL_PUBLISHABLE_KEY;
      else process.env.MOORSYL_PUBLISHABLE_KEY = previousKey;
    }
  });

  it("distinguishes approved, denied, and provider rate-limited checks", async () => {
    const previousKey = process.env.MOORSYL_PUBLISHABLE_KEY;
    process.env.MOORSYL_PUBLISHABLE_KEY = "pk_test_unit_test";
    try {
      assert.equal(await checkMoorsylVerification("ver_test_1", "123456", async () => jsonResponse({ status: "approved" })), true);
      assert.equal(await checkMoorsylVerification("ver_test_1", "123456", async () => jsonResponse({ status: "denied" })), false);
      await assert.rejects(
        checkMoorsylVerification("ver_test_1", "123456", async () => jsonResponse({}, 429)),
        (error: unknown) => error instanceof MoorsylVerificationError && error.kind === "rate_limited",
      );
    } finally {
      if (previousKey === undefined) delete process.env.MOORSYL_PUBLISHABLE_KEY;
      else process.env.MOORSYL_PUBLISHABLE_KEY = previousKey;
    }
  });

  it("fails closed when the key is missing or the provider response is malformed", async () => {
    const previousKey = process.env.MOORSYL_PUBLISHABLE_KEY;
    delete process.env.MOORSYL_PUBLISHABLE_KEY;
    try {
      await assert.rejects(
        sendMoorsylVerification("+22236123456", async () => jsonResponse({ verificationId: "unexpected" })),
        (error: unknown) => error instanceof MoorsylVerificationError && error.kind === "configuration",
      );
    } finally {
      if (previousKey !== undefined) process.env.MOORSYL_PUBLISHABLE_KEY = previousKey;
    }

    process.env.MOORSYL_PUBLISHABLE_KEY = "pk_test_unit_test";
    try {
      await assert.rejects(
        sendMoorsylVerification("+22236123456", async () => jsonResponse({})),
        (error: unknown) => error instanceof MoorsylVerificationError && error.kind === "provider",
      );
    } finally {
      if (previousKey === undefined) delete process.env.MOORSYL_PUBLISHABLE_KEY;
      else process.env.MOORSYL_PUBLISHABLE_KEY = previousKey;
    }
  });
});
