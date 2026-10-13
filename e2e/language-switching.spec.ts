import { expect, test, type Page } from '@playwright/test';

const baseURL =
  process.env.E2E_BASE_URL ??
  (process.env.REPLIT_DEV_DOMAIN
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : undefined);

const languageOptions = [
  {
    value: 'ar',
    label: 'العربية',
    heading: 'إعلانات تستحق المشاهدة',
    dir: 'rtl',
    title: 'Le7rithe.com | السوق الزراعي الموريتاني',
    heroBrand: 'Le7rithe.com · السوق الزراعي الموريتاني',
  },
  {
    value: 'fr',
    label: 'Français',
    heading: 'Des annonces à découvrir',
    dir: 'ltr',
    title: 'Le7rithe.com | Marché agricole mauritanien',
    heroBrand: 'Le7rithe.com · marché agricole mauritanien',
  },
  {
    value: 'en',
    label: 'English',
    heading: 'Listings worth a look',
    dir: 'ltr',
    title: 'Le7rithe.com | Mauritanian agricultural marketplace',
    heroBrand: 'Le7rithe.com · Mauritania’s farm market',
  },
] as const;

const listingLanguageOptions = [
  {
    value: 'fr',
    featuredHeading: 'Des annonces à découvrir',
    listingsHeading: 'Toutes les annonces',
    searchAction: 'Rechercher',
    detailBreadcrumb: 'Toutes les annonces',
    requestedPrice: 'Prix demandé',
    sellerContact: 'Informations de contact du vendeur',
  },
  {
    value: 'en',
    featuredHeading: 'Listings worth a look',
    listingsHeading: 'All listings',
    searchAction: 'Search',
    detailBreadcrumb: 'All listings',
    requestedPrice: 'Asking price',
    sellerContact: 'Seller contact information',
  },
] as const;

async function clickNavigationLink(
  page: Page,
  testId: string,
) {
  await page.getByTestId('button-open-menu').click();
  await page.getByTestId(testId).click();
}

async function disableDevBannerPointerEvents(page: Page) {
  await page.addStyleTag({
    content: '#replit-dev-banner, #replit-dev-banner * { pointer-events: none !important; }',
  });
}

async function selectLanguage(page: Page, value: 'ar' | 'fr' | 'en') {
  const selector = page.getByTestId('select-language');
  await selector.click();
  await page.getByTestId(`language-option-${value}`).click();
  await expect(selector).toHaveAttribute('data-language', value);
}

for (const viewport of [
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'narrow', width: 390, height: 844 },
]) {
  test.describe(`${viewport.name} language switching`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test.skip(!baseURL, 'Set E2E_BASE_URL to run the language switching regression.');

    test('updates the selector, page text, document locale, and direction without a reload', async ({
      page,
    }) => {
      await page.goto('/');
      await disableDevBannerPointerEvents(page);

      const selector = page.getByTestId('select-language');
      const headerLogo = page.getByTestId('link-header-brand');
      await expect(selector).toBeVisible();
      await expect(selector).toHaveAttribute('data-language', 'ar');
      await expect(page).toHaveTitle(languageOptions[0].title);
      await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /Le7rithe\.com/);
      await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', languageOptions[0].title);
      await expect(page.locator('meta[name="twitter:title"]')).toHaveAttribute('content', languageOptions[0].title);
      await expect(headerLogo).toBeVisible();
      await expect(headerLogo).toContainText('Le7rithe.com');
      await expect(page.getByTestId('site-header')).toHaveAttribute('dir', 'ltr');
      await expect(page.getByTestId('link-footer-brand')).toContainText('Le7rithe.com');
      await expect(page.getByText(languageOptions[0].heroBrand, { exact: true })).toBeVisible();
      await selector.click();
      await expect(page.getByRole('option')).toHaveCount(3);
      for (const option of languageOptions) {
        const menuItem = page.getByTestId(`language-option-${option.value}`);
        await expect(menuItem).toHaveAttribute(
          'aria-label',
          `${option.label} (${option.value.toUpperCase()})`,
        );
      }
      await expect(page.getByTestId('language-option-ar')).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByTestId('language-flag-ar')).toHaveAttribute('data-language-flag', 'ar');
      await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
      if (viewport.width < 640) {
        const headerControls = [
          page.getByTestId('button-open-menu'),
          page.getByTestId('link-header-brand'),
          selector,
        ];
        const boxes = await Promise.all(headerControls.map((control) => control.boundingBox()));
        expect(boxes.every((box) => box !== null)).toBe(true);
        const horizontalBoxes = boxes
          .filter((box): box is NonNullable<typeof box> => box !== null)
          .sort((left, right) => left.x - right.x);
        for (let index = 1; index < horizontalBoxes.length; index += 1) {
          expect(horizontalBoxes[index - 1].x + horizontalBoxes[index - 1].width)
            .toBeLessThanOrEqual(horizontalBoxes[index].x + 1);
        }
      }
      await page.getByTestId('language-option-fr').click();
      await expect(page.getByTestId('language-flag-fr')).toHaveAttribute('data-language-flag', 'fr');

      for (const option of languageOptions.slice(1)) {
        if (option.value === 'en') {
          await selectLanguage(page, option.value);
        }

        await expect(selector).toHaveAttribute('data-language', option.value);
        await expect(page.locator('html')).toHaveAttribute('lang', option.value);
        await expect(page.locator('html')).toHaveAttribute('dir', option.dir);
        await expect(page).toHaveTitle(option.title);
        await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /Le7rithe\.com/);
        await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', option.title);
        await expect(page.locator('meta[name="twitter:title"]')).toHaveAttribute('content', option.title);
        await expect(headerLogo).toContainText('Le7rithe.com');
        await expect(page.getByText(option.heroBrand, { exact: true })).toBeVisible();
        await expect(
          page
            .getByTestId('section-featured-listings')
            .getByRole('heading', { name: option.heading, exact: true }),
        ).toBeVisible();
      }
    });

    test('keeps public listing and detail labels translated without a reload', async ({ page }) => {
      await page.goto('/listings');
      await disableDevBannerPointerEvents(page);

      const selector = page.getByTestId('select-language');
      const headerLogo = page.getByTestId('link-header-brand');
      await expect(selector).toBeVisible();
      await expect(headerLogo).toBeVisible();
      await expect(headerLogo).toContainText('Le7rithe.com');
      await expect(page.getByTestId('site-header')).toHaveAttribute('dir', 'ltr');
      await expect(page.getByTestId('input-search')).toBeVisible();

      const listingsUrl = page.url();
      for (const option of listingLanguageOptions) {
        await selectLanguage(page, option.value);

        await expect(selector).toHaveAttribute('data-language', option.value);
        await expect(page).toHaveURL(listingsUrl);
        await expect(page.locator('html')).toHaveAttribute('lang', option.value);
        await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
        await expect(page.getByRole('heading', { name: option.listingsHeading, exact: true })).toBeVisible();
        await expect(page.getByTestId('button-submit-search')).toHaveText(option.searchAction);
      }

      const firstListing = page.locator('[data-testid^="link-listing-"]').first();
      await expect(firstListing).toBeVisible();
      await firstListing.click();
      await expect(page.getByTestId('link-back-listings')).toBeVisible();
      await expect(headerLogo).toContainText('Le7rithe.com');

      const detailUrl = page.url();
      for (const option of listingLanguageOptions) {
        await selectLanguage(page, option.value);

        await expect(selector).toHaveAttribute('data-language', option.value);
        await expect(page).toHaveURL(detailUrl);
        await expect(page.locator('html')).toHaveAttribute('lang', option.value);
        await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
        await expect(page.getByTestId('link-back-listings')).toHaveText(option.detailBreadcrumb);
        await expect(page.getByText(option.requestedPrice, { exact: true })).toBeVisible();
        await expect(
          page.getByRole('heading', { name: option.sellerContact, exact: true }),
        ).toBeVisible();
      }
    });

    test('persists French and English after reload and navigation', async ({ page }) => {
      for (const option of listingLanguageOptions) {
        await page.goto('/');
        await disableDevBannerPointerEvents(page);

        const selector = page.getByTestId('select-language');
        await selectLanguage(page, option.value);
        await expect(selector).toHaveAttribute('data-language', option.value);
        await expect(page.locator('html')).toHaveAttribute('lang', option.value);
        await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
        await expect(
          page
            .getByTestId('section-featured-listings')
            .getByRole('heading', { name: option.featuredHeading, exact: true }),
        ).toBeVisible();
        await expect
          .poll(() =>
            page.evaluate(() =>
              (
                globalThis as {
                  localStorage: { getItem: (key: string) => string | null };
                }
              ).localStorage.getItem('marketplace-language'),
            ),
          )
          .toBe(option.value);

        await page.reload();
        await disableDevBannerPointerEvents(page);

        await expect(selector).toHaveAttribute('data-language', option.value);
        await expect(page.locator('html')).toHaveAttribute('lang', option.value);
        await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
        await expect(
          page
            .getByTestId('section-featured-listings')
            .getByRole('heading', { name: option.featuredHeading, exact: true }),
        ).toBeVisible();

        await clickNavigationLink(page, 'link-nav-allListings');

        await expect(page).toHaveURL(/\/listings$/);
        await expect(selector).toHaveAttribute('data-language', option.value);
        await expect(page.locator('html')).toHaveAttribute('lang', option.value);
        await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
        await expect(page.getByRole('heading', { name: option.listingsHeading, exact: true })).toBeVisible();
        await expect(page.getByTestId('button-submit-search')).toHaveText(option.searchAction);

        await clickNavigationLink(page, 'link-nav-discover');

        await expect(page).toHaveURL(/\/$/);
        await expect(selector).toHaveAttribute('data-language', option.value);
        await expect(page.locator('html')).toHaveAttribute('lang', option.value);
        await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
        await expect(
          page
            .getByTestId('section-featured-listings')
            .getByRole('heading', { name: option.featuredHeading, exact: true }),
        ).toBeVisible();
      }
    });
  });
}
