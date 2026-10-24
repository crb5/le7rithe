import { expect, test } from '@playwright/test';

const baseURL =
  process.env.E2E_BASE_URL ??
  (process.env.REPLIT_DEV_DOMAIN
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : undefined);

test.skip(!baseURL, 'Set E2E_BASE_URL to run the branding regression.');

test('shows the official brand without a subtitle on auth and publishing entry pages', async ({ page }) => {
  for (const path of ['/sign-in', '/sign-up']) {
    await page.goto(path);
    const brand = page.getByTestId('link-header-brand');
    await expect(brand).toHaveAttribute('aria-label', 'le7rithe');
    await expect(brand).toHaveAttribute('href', '/');
    await expect(brand.locator('.sh-word')).toHaveText('le7rithe');
    await expect(brand.locator('.sh-word')).toHaveAttribute('dir', 'ltr');
    await expect(brand.locator('.sh-mark')).toHaveCount(1);
    await expect(brand.locator('.sh-mark')).toBeVisible();
  }

  await page.goto('/admin/login');
  await expect(page.getByTestId('link-not-found-home')).toBeVisible();
  await expect(page.getByText('بوابة المشرفين')).toHaveCount(0);

  await page.goto('/add-listing');
  const publishPrompt = page.getByTestId('publish-auth-prompt');
  await expect(publishPrompt).toBeVisible();
  await expect(publishPrompt.getByRole('link', { name: 'le7rithe' }))
    .toHaveText('le7rithe');
});

test('keeps the sign-in page on-brand and correctly ordered in every locale', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript(() => window.localStorage.removeItem('marketplace-language'));
  await page.goto('/sign-in');
  await page.addStyleTag({
    content: '#replit-dev-banner, #replit-dev-banner * { pointer-events: none !important; }',
  });

  const authPage = page.getByTestId('auth-page');
  const authHeader = page.getByTestId('auth-header');
  const brand = page.getByTestId('link-header-brand');
  const languageButton = page.getByTestId('select-language');
  const card = page.locator('.cl-cardBox');

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));

    for (const locale of ['ar', 'fr', 'en'] as const) {
      const currentLocale = await languageButton.getAttribute('data-language');
      if (currentLocale !== locale) {
        const directionChanges =
          (currentLocale === 'ar') !== (locale === 'ar');
        await languageButton.click();
        await page.getByTestId(`language-option-${locale}`).click();
        await expect(languageButton).toHaveAttribute('data-language', locale);
        if (directionChanges) {
          const localeAnimations = await authHeader.evaluate(
            (element) => element.getAnimations({ subtree: true }).length,
          );
          expect(localeAnimations).toBeGreaterThan(0);
        }
      }

      const direction = locale === 'ar' ? 'rtl' : 'ltr';
      await expect(authPage).toHaveAttribute('dir', direction);
      await expect(authHeader).toHaveAttribute('dir', 'ltr');
      await expect(brand).toHaveAttribute('dir', direction);
      await expect(brand.locator('.sh-word')).toHaveAttribute('dir', 'ltr');
      await expect(brand.locator('.sh-tagline')).toHaveCount(0);
      await expect(card).toBeVisible();
      await expect(page.getByTestId(`language-flag-${locale}`))
        .toHaveAttribute('data-language-flag', locale);

      const flexDirection = await authHeader.evaluate(
        (element) => getComputedStyle(element).flexDirection,
      );
      expect(flexDirection).toBe(locale === 'ar' ? 'row' : 'row-reverse');

      const brandBox = await brand.boundingBox();
      const languageBox = await languageButton.boundingBox();
      const cardBox = await card.boundingBox();
      const headerBox = await authHeader.boundingBox();
      expect(brandBox).not.toBeNull();
      expect(languageBox).not.toBeNull();
      expect(cardBox).not.toBeNull();
      expect(headerBox).not.toBeNull();
      if (currentLocale !== locale) {
        await authHeader.evaluate(async (element) => {
          await Promise.all(
            element.getAnimations({ subtree: true }).map((animation) =>
              animation.finished.catch(() => undefined),
            ),
          );
        });
      }
      const settledBrandBox = await brand.boundingBox();
      const settledLanguageBox = await languageButton.boundingBox();
      expect(settledBrandBox).not.toBeNull();
      expect(settledLanguageBox).not.toBeNull();
      if (locale === 'ar') {
        expect(settledBrandBox!.x + settledBrandBox!.width)
          .toBeLessThanOrEqual(settledLanguageBox!.x + 1);
      } else {
        expect(settledLanguageBox!.x + settledLanguageBox!.width)
          .toBeLessThanOrEqual(settledBrandBox!.x + 1);
      }
      expect(cardBox!.x).toBeGreaterThanOrEqual(0);
      expect(cardBox!.x + cardBox!.width).toBeLessThanOrEqual(viewport.width);
      expect(cardBox!.y).toBeGreaterThanOrEqual(headerBox!.y + headerBox!.height - 1);
      expect(await page.locator('html').evaluate((element) => element.scrollWidth))
        .toBeLessThanOrEqual(viewport.width);

      if (locale === 'ar') {
        await expect(page.locator('input[placeholder="أدخل عنوان بريدك الإلكتروني"]'))
          .toBeVisible();
      }
    }
  }

  await languageButton.click();
  await expect(page.getByTestId('language-option-fr')).toBeVisible();
  await page.getByTestId('language-option-fr').click();
  await expect(languageButton).toHaveAttribute('data-language', 'fr');
  await brand.click();
  await expect(page.getByTestId('site-header')).toBeVisible();
  await expect(page.getByTestId('select-language')).toHaveAttribute('data-language', 'fr');
  await page.getByTestId('button-open-menu').click();
  await page.getByTestId('link-sidebar-sign-in').click();
  await expect(page.getByTestId('auth-header')).toBeVisible();
  await expect(page.getByTestId('select-language')).toHaveAttribute('data-language', 'fr');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/sign-up');
  await expect(page.getByTestId('auth-header')).toBeVisible();
  await expect(page.getByTestId('link-header-brand')).toBeVisible();
  await expect(page.getByTestId('select-language')).toHaveAttribute('data-language', 'ar');
  await expect(page.getByTestId('auth-card-container')).toBeVisible();
  expect(await page.locator('html').evaluate((element) => element.scrollWidth))
    .toBeLessThanOrEqual(390);
});