import { expect, test } from "@playwright/test";

const baseURL =
  process.env.E2E_BASE_URL ??
  (process.env.REPLIT_DEV_DOMAIN
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : undefined);

test.skip(!baseURL, "Set E2E_BASE_URL to run the local-mock signup browser check.");

test("phone signup choice, validation, mocked send and mocked verification errors", async ({ page }) => {
  let sendAudit: { modeIsSignUp: boolean; phoneHasMauritaniaFormat: boolean; passwordOmitted: boolean } | undefined;
  let verifyStatus = 409;
  let verifyCode = "PHONE_ALREADY_REGISTERED";
  const verifyAudits: Array<{
    firstNamePresent: boolean;
    lastNamePresent: boolean;
    passwordPresent: boolean;
    roleOmitted: boolean;
  }> = [];

  await page.addInitScript(() => window.localStorage.setItem("marketplace-language", "en"));
  await page.route("**/api/auth/phone/sign-in/send", async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    sendAudit = {
      modeIsSignUp: body.mode === "sign-up",
      phoneHasMauritaniaFormat: typeof body.phone === "string" && /^\+222[0-9]{8}$/.test(body.phone),
      passwordOmitted: !Object.hasOwn(body, "password"),
    };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ verificationId: "local-browser-proof", resendAfterSeconds: 60 }),
    });
  });
  await page.route("**/api/auth/phone/sign-in/verify", async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    verifyAudits.push({
      firstNamePresent: typeof body.firstName === "string",
      lastNamePresent: typeof body.lastName === "string",
      passwordPresent: typeof body.password === "string",
      roleOmitted: !Object.hasOwn(body, "role"),
    });
    await route.fulfill({
      status: verifyStatus,
      contentType: "application/json",
      body: JSON.stringify({ code: verifyCode }),
    });
  });

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/sign-in");
  await page.locator('a[href="/sign-up"]').click();
  await expect(page.getByTestId("sign-up-choice")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
  await expect(page.getByTestId("button-choice-phone-sign-up")).toBeVisible();
  await expect(page.getByTestId("button-choice-google-sign-up")).toBeVisible();
  await expect(page.getByTestId("button-choice-email-sign-up")).toBeVisible();
  await expect(page.getByTestId("link-choice-sign-in")).toBeVisible();
  await expect(page.getByTestId("input-phone-signup-first-name")).toHaveCount(0);
  await expect(page.getByTestId("input-phone-signup-password")).toHaveCount(0);
  await expect(page.evaluate(() => document.documentElement.scrollWidth)).resolves.toBe(1280);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.evaluate(() => document.documentElement.scrollWidth)).resolves.toBe(390);
  await page.getByTestId("button-choice-phone-sign-up").click();
  await expect(page.getByTestId("input-phone-signup-first-name")).toBeVisible();
  await expect(page.getByTestId("input-phone-signup-last-name")).toBeVisible();
  await expect(page.getByTestId("input-phone-sign-in-number")).toBeVisible();
  await expect(page.getByTestId("input-phone-signup-email")).not.toHaveAttribute("required", "");
  await expect(page.getByTestId("input-phone-signup-password")).toHaveAttribute("minlength", "8");
  await expect(page.getByTestId("input-phone-signup-password")).toHaveAttribute("maxlength", "128");

  await page.getByTestId("input-phone-signup-first-name").fill("Test");
  await page.getByTestId("input-phone-signup-last-name").fill("Signup");
  await page.getByTestId("input-phone-sign-in-number").fill("20000000");
  await page.getByTestId("input-phone-signup-password").fill("test-only arbitrary non-secret");
  await page.getByTestId("button-phone-sign-in-send-code").click();
  expect(sendAudit).toBeUndefined(); // Native required-consent validation must prevent the request.
  await page.getByTestId("input-phone-signup-consent").check();
  await page.getByTestId("input-phone-sign-in-number").fill("1234567");
  await page.getByTestId("button-phone-sign-in-send-code").click();
  await expect(page.getByRole("alert")).toContainText(/8/);
  expect(sendAudit).toBeUndefined();

  await page.getByTestId("input-phone-sign-in-number").fill("20000000");
  await page.getByTestId("button-phone-sign-in-send-code").click();
  await expect(page.getByTestId("input-phone-sign-in-code")).toBeVisible();
  await expect(page.getByRole("status")).toContainText(/59|60/);
  expect(sendAudit).toEqual({
    modeIsSignUp: true,
    phoneHasMauritaniaFormat: true,
    passwordOmitted: true,
  });
  await page.getByTestId("input-phone-sign-in-code").fill("123456");
  await page.getByTestId("button-phone-sign-in-verify").click();
  await expect(page.getByTestId("link-existing-phone-sign-in")).toBeVisible();
  await expect(page.getByRole("alert")).toContainText(/already|registered/i);

  verifyStatus = 400;
  verifyCode = "PASSWORD_REJECTED";
  await page.getByTestId("button-phone-sign-in-verify").click();
  await expect(page.getByRole("alert")).toContainText(/password/i);
  expect(verifyAudits).toHaveLength(2);
  expect(verifyAudits.every((audit) =>
    audit.firstNamePresent && audit.lastNamePresent && audit.passwordPresent && audit.roleOmitted,
  )).toBe(true);

  await page.getByTestId("button-phone-sign-up-back").click();
  await expect(page.getByTestId("sign-up-choice")).toBeVisible();
  await page.getByTestId("button-choice-phone-sign-up").click();
  await expect(page.getByTestId("input-phone-signup-password")).toHaveValue("");
  await page.getByTestId("button-phone-sign-up-back").click();

  await page.getByTestId("button-choice-email-sign-up").click();
  await expect(page.getByTestId("custom-sign-up")).toBeVisible();
  await expect(page.getByTestId("input-sign-up-email")).toBeVisible();
  await expect(page.getByTestId("button-email-sign-up-back")).toBeVisible();
});
