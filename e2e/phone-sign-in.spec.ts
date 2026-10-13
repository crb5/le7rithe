import { expect, test } from "@playwright/test";

const baseURL =
  process.env.E2E_BASE_URL ??
  (process.env.REPLIT_DEV_DOMAIN
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : undefined);

test.skip(!baseURL, "Set E2E_BASE_URL to run the phone sign-in browser check.");

test("sends the Mauritanian phone and OTP to the server before attempting Clerk ticket sign-in", async ({ page }) => {
  let sendRequestAccepted = false;
  let verifyRequestAccepted = false;
  let clerkTicketStrategyRequested = false;
  let clerkTicketRequestReceived = false;

  await page.route("**/api/auth/phone/sign-in/send", async (route) => {
    const body = route.request().postDataJSON() as { phone?: string };
    sendRequestAccepted = body.phone === "+22236123456";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ verificationId: "browser-test-verification", resendAfterSeconds: 60 }),
    });
  });
  await page.route("**/api/auth/phone/sign-in/verify", async (route) => {
    const body = route.request().postDataJSON() as { verificationId?: string; code?: string };
    verifyRequestAccepted = sendRequestAccepted
      && body.verificationId === "browser-test-verification"
      && body.code === "123456";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ticket: "browser-test-clerk-ticket", requiresName: false }),
    });
  });
  await page.route(/\/client\/sign_ins(?:\/|\?|$)/, async (route) => {
    const postData = route.request().postData();
    let strategy = "";
    if (postData) {
      try {
        const parsed = JSON.parse(postData) as { strategy?: unknown };
        strategy = typeof parsed.strategy === "string" ? parsed.strategy : "";
      } catch {
        strategy = new URLSearchParams(postData).get("strategy") ?? "";
      }
    }
    if (strategy !== "ticket") {
      await route.continue();
      return;
    }
    clerkTicketStrategyRequested = true;
    clerkTicketRequestReceived = verifyRequestAccepted;
    await route.fulfill({
      status: 422,
      contentType: "application/json",
      body: JSON.stringify({
        errors: [{ code: "form_param_format_invalid", message: "The browser test uses a fake Clerk ticket." }],
      }),
    });
  });

  await page.addInitScript(() => window.localStorage.setItem("marketplace-language", "ar"));
  await page.goto("/sign-in");
  const googleButton = page.locator(".cl-socialButtonsBlockButton__google");
  const phoneButton = page.getByTestId("button-phone-sign-in");
  await expect(googleButton).toBeVisible();
  await expect(phoneButton).toBeVisible();

  const placement = await phoneButton.evaluate((button) => {
    const card = button.closest(".cl-cardBox");
    const google = card?.querySelector(".cl-socialButtonsBlockButton__google");
    const divider = card?.querySelector(".cl-dividerRow");
    return {
      insideSocialButtons: Boolean(button.closest(".cl-socialButtons")),
      followsGoogle: Boolean(
        google && (google.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING),
      ),
      precedesDivider: Boolean(
        divider && (button.compareDocumentPosition(divider) & Node.DOCUMENT_POSITION_FOLLOWING),
      ),
    };
  });
  expect(placement).toEqual({
    insideSocialButtons: true,
    followsGoogle: true,
    precedesDivider: true,
  });

  const buttonStyle = async (locator: typeof phoneButton) => locator.evaluate((button) => {
    const style = getComputedStyle(button);
    return {
      height: button.getBoundingClientRect().height,
      borderRadius: style.borderRadius,
      borderWidth: style.borderWidth,
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      padding: style.padding,
    };
  });
  expect(await buttonStyle(phoneButton)).toEqual(await buttonStyle(googleButton));

  await phoneButton.click();
  await expect(page.getByTestId("input-phone-sign-in-number")).toBeVisible();
  await expect(googleButton).toBeHidden();
  await expect(page.locator(".cl-dividerRow")).toBeHidden();
  await expect(page.locator(".cl-form")).toBeHidden();
  await expect(page.getByTestId("button-phone-sign-in-back")).toBeVisible();
  await page.getByTestId("button-phone-sign-in-back").click();
  await expect(googleButton).toBeVisible();
  await expect(page.locator(".cl-dividerRow")).toBeVisible();
  await expect(page.locator(".cl-form")).toBeVisible();
  await expect(page.getByTestId("button-phone-sign-in")).toBeVisible();

  await phoneButton.click();
  await expect(page.getByTestId("input-phone-sign-in-number")).toBeVisible();
  await page.getByTestId("input-phone-sign-in-number").fill("36123456");
  await page.getByTestId("button-phone-sign-in-send-code").click();
  await expect(page.getByTestId("input-phone-sign-in-code")).toBeVisible();
  await page.getByTestId("input-phone-sign-in-code").fill("123456");
  await page.getByTestId("button-phone-sign-in-verify").click();

  await expect.poll(() => verifyRequestAccepted, { timeout: 10_000 }).toBe(true);
  await expect.poll(() => clerkTicketStrategyRequested, { timeout: 20_000 }).toBe(true);
  await expect.poll(() => clerkTicketRequestReceived, { timeout: 20_000 }).toBe(true);
  await expect(page.getByRole("alert")).toBeVisible();
  expect(sendRequestAccepted).toBe(true);
  expect(verifyRequestAccepted).toBe(true);
});

test("offers phone-only account registration after policy consent", async ({ page }) => {
  let sendRequestAccepted = false;
  let verifyRequestAccepted = false;
  let clerkTicketRequestReceived = false;

  await page.route("**/api/auth/phone/sign-in/send", async (route) => {
    const body = route.request().postDataJSON() as { phone?: string; mode?: string };
    sendRequestAccepted = body.phone === "+22236123456" && body.mode === "sign-up";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ verificationId: "browser-signup-verification", resendAfterSeconds: 60 }),
    });
  });
  await page.route("**/api/auth/phone/sign-in/verify", async (route) => {
    const body = route.request().postDataJSON() as { verificationId?: string; code?: string; name?: string };
    verifyRequestAccepted = sendRequestAccepted
      && body.verificationId === "browser-signup-verification"
      && body.code === "123456" && body.name === "Cheikhou";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ticket: "browser-signup-clerk-ticket", requiresName: true }),
    });
  });
  await page.route(/\/client\/sign_ins(?:\/|\?|$)/, async (route) => {
    const postData = route.request().postData() || "";
    if (!postData.includes("ticket")) {
      await route.continue();
      return;
    }
    clerkTicketRequestReceived = verifyRequestAccepted;
    await route.fulfill({
      status: 422,
      contentType: "application/json",
      body: JSON.stringify({
        errors: [{ code: "form_param_format_invalid", message: "The browser test uses a fake Clerk ticket." }],
      }),
    });
  });

  await page.addInitScript(() => window.localStorage.setItem("marketplace-language", "ar"));
  await page.goto("/sign-up");
  const phoneSignupButton = page.getByTestId("button-phone-sign-up");
  await expect(phoneSignupButton).toBeVisible();
  await phoneSignupButton.click();
  await expect(page.getByRole("alert")).toContainText(/الموافقة/);
  await page.getByTestId("input-signup-policy-consent").check();
  await phoneSignupButton.click();
  await expect(page.getByTestId("input-phone-sign-in-number")).toBeVisible();
  await expect(page.getByTestId("input-phone-signup-name")).toBeVisible();
  await expect(page.getByTestId("input-phone-signup-last-name")).toHaveCount(0);
  await page.getByTestId("input-phone-signup-name").fill("Cheikhou");
  await expect(page.getByTestId("input-sign-up-email")).toHaveCount(0);
  await expect(page.getByTestId("input-phone-signup-email")).toBeVisible();
  await expect(page.getByTestId("input-phone-signup-email")).not.toHaveAttribute("required", "");
  await page.getByTestId("input-phone-signup-email").fill("optional@example.com");
  await expect(page.getByTestId("button-google-sign-up")).toHaveCount(0);
  await page.getByTestId("input-phone-sign-in-number").fill("36123456");
  await page.getByTestId("button-phone-sign-in-send-code").click();
  await page.getByTestId("input-phone-sign-in-code").fill("123456");
  await page.getByTestId("button-phone-sign-in-verify").click();

  await expect.poll(() => verifyRequestAccepted, { timeout: 10_000 }).toBe(true);
  await expect.poll(() => clerkTicketRequestReceived, { timeout: 20_000 }).toBe(true);
  await expect(page.getByTestId("button-phone-sign-in-back")).toBeVisible();
  await page.getByTestId("button-phone-sign-in-back").click();
  await expect(page.getByTestId("input-sign-up-email")).toBeVisible();
});

test("registration accepts a phone alone, rejects missing contacts and validates optional phones", async ({ page }) => {
  let phoneSent = "";
  await page.route("**/api/auth/phone/sign-in/send", async (route) => {
    phoneSent = route.request().postDataJSON().phone;
    await route.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ verificationId: "contact-choice-test", resendAfterSeconds: 60 }) });
  });
  await page.addInitScript(() => window.localStorage.setItem("marketplace-language", "ar"));
  await page.goto("/sign-up");
  await page.getByTestId("input-first-name").fill("Test");
  await page.getByTestId("input-last-name").fill("Account");
  await page.getByTestId("input-signup-policy-consent").check();
  const phone = page.getByTestId("input-sign-up-phone");
  await expect(phone).toBeVisible();
  await expect(phone).not.toHaveAttribute("required", "");
  await page.getByTestId("button-create-account").click();
  await expect(page.getByRole("alert")).toContainText("أو رقم هاتف");
  await phone.fill("361234567");
  await page.getByTestId("button-create-account").click();
  await expect(page.getByRole("alert")).toContainText("8");
  expect(phoneSent).toBe("");
  await phone.fill("36123456");
  await page.getByTestId("input-last-name").clear();
  await expect(page.getByTestId("input-last-name")).not.toHaveAttribute("required", "");
  await page.getByTestId("button-create-account").click();
  await expect(page.getByTestId("input-phone-sign-in-code")).toBeVisible();
  expect(phoneSent).toBe("+22236123456");
});

test("existing phone registration shows sign-in guidance without creating a Clerk session", async ({ page }) => {
  let clerkRequests = 0;
  await page.route(/\/client\/sign_ins(?:\/|\?|$)/, async (route) => {
    if (route.request().method() === "POST") clerkRequests++;
    await route.continue();
  });
  await page.route("**/api/auth/phone/sign-in/send", (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ verificationId: "existing-phone-test", resendAfterSeconds: 1 }),
  }));
  await page.route("**/api/auth/phone/sign-in/verify", (route) => route.fulfill({
    status: 409, contentType: "application/json",
    body: JSON.stringify({ error: "Existing account", code: "PHONE_ALREADY_REGISTERED" }),
  }));
  await page.addInitScript(() => window.localStorage.setItem("marketplace-language", "ar"));
  await page.goto("/sign-up");
  await page.getByTestId("input-signup-policy-consent").check();
  await page.getByTestId("button-phone-sign-up").click();
  await page.getByTestId("input-phone-signup-name").fill("Cheikhou");
  await page.getByTestId("input-phone-sign-in-number").fill("36123456");
  await page.getByTestId("button-phone-sign-in-send-code").click();
  await page.getByTestId("input-phone-sign-in-code").fill("123456");
  await page.getByTestId("button-phone-sign-in-verify").click();
  await expect(page.getByRole("alert")).toContainText("يرجى تسجيل الدخول");
  await expect(page.getByTestId("link-existing-phone-sign-in")).toBeVisible();
  expect(clerkRequests).toBe(0);
});
