import { expect, test } from "@playwright/test";

const locales = [
  { code: "ar", title: "سياسة الخصوصية", direction: "rtl" },
  { code: "fr", title: "Politique de confidentialité", direction: "ltr" },
  { code: "en", title: "Privacy Policy", direction: "ltr" },
] as const;

test("renders every public privacy policy section and internal link in all supported languages", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/privacy");
  await page.addStyleTag({
    content: "#replit-dev-banner, #replit-dev-banner * { pointer-events: none !important; }",
  });

  const languageSelector = page.getByTestId("select-language");
  for (const [localeIndex, locale] of locales.entries()) {
    if (localeIndex > 0) {
      await languageSelector.click();
      await page.getByTestId(`language-option-${locale.code}`).click();
    }

    await expect(languageSelector).toHaveAttribute("data-language", locale.code);
    await expect(page.locator("html")).toHaveAttribute("lang", locale.code);
    await expect(page.locator("html")).toHaveAttribute("dir", locale.direction);
    await expect(page.getByTestId("privacy-policy-title")).toHaveText(locale.title);
    await expect(page.getByTestId("privacy-policy-introduction")).toBeVisible();
    await expect(page.getByTestId("privacy-policy-contents")).toBeVisible();
    await expect(page.getByTestId("privacy-policy-footer")).toBeVisible();
    await expect(page.getByTestId("link-footer-brand")).toContainText("le7rithe");

    const sections = page.locator('[data-testid^="legal-section-privacy-"]');
    const contentsLinks = page.locator('[data-testid^="link-privacy-contents-"]');
    await expect(sections).toHaveCount(14);
    await expect(contentsLinks).toHaveCount(14);

    for (let index = 1; index <= 14; index += 1) {
      const link = page.getByTestId(`link-privacy-contents-${index}`);
      await expect(link).toHaveAttribute("href", `#privacy-section-${index}`);
      await link.click();
      await expect(page).toHaveURL(new RegExp(`#privacy-section-${index}$`));
      await expect(page.locator(`#privacy-section-${index}`)).toBeVisible();
    }

    const backLink = page.getByTestId("link-legal-back-privacy");
    await expect(backLink).toHaveAttribute("href", "/");
    if (localeIndex < locales.length - 1) {
      await page.evaluate(() => window.scrollTo(0, 0));
    }
  }

  expect(pageErrors).toEqual([]);
});
