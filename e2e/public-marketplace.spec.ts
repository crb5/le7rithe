import { expect, test } from '@playwright/test';

const baseURL =
  process.env.E2E_BASE_URL ??
  (process.env.REPLIT_DEV_DOMAIN
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : undefined);

test.describe('public marketplace browsing', () => {
  test.skip(!baseURL, 'Set E2E_BASE_URL to run the public marketplace regression.');

  test('lets visitors browse and only asks for auth when publishing', async ({ page }) => {
    await page.goto('/');
    await expect(page).not.toHaveURL(/\/sign-in/);
    await expect(page.getByTestId('link-category-tractors')).toBeVisible();
    await page.locator('#replit-dev-banner').evaluateAll((banners) => {
      for (const banner of banners) banner.remove();
    });
    await page.getByTestId('button-open-menu').click();
    await expect(page.getByTestId('link-nav-addListing')).toBeVisible();
    await expect(page.getByTestId('link-nav-addListing')).toHaveAttribute('href', '/add-listing');

    await page.goto('/listings');
    await expect(page).not.toHaveURL(/\/sign-in/);
    await expect(page.getByTestId('input-search')).toBeVisible();

    const publicListingsResponse = await page.request.get('/api/listings?limit=50');
    expect(publicListingsResponse.status()).toBe(200);
    const publicListings = await publicListingsResponse.json() as {
      items: Array<{ id: number; title: string }>;
      total: number;
    };
    expect(publicListings.items.every((listing) => !/^E2E\s/i.test(listing.title))).toBe(true);
    if (publicListings.total > 0) {
      expect(publicListings.items.some((listing) => !/^E2E\s/i.test(listing.title))).toBe(true);
    }

    const firstListing = page.locator('a[href^="/listings/"]').first();
    if (await firstListing.count()) {
      await expect(firstListing).not.toContainText(/^E2E\s/i);
      await firstListing.click();
      await expect(page).not.toHaveURL(/\/sign-in/);
    }

    await page.goto('/add-listing');
    await expect(page.getByTestId('publish-auth-prompt')).toBeVisible();
    await expect(page.getByTestId('link-publish-sign-in')).toHaveAttribute(
      'href',
      /\/sign-in\?redirect_url=%2Fadd-listing/,
    );
    await expect(page.getByTestId('link-publish-sign-up')).toHaveAttribute(
      'href',
      /\/sign-up\?redirect_url=%2Fadd-listing/,
    );
  });

  test('keeps the original mobile publish icon visible to visitors', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const mobilePublish = page.getByTestId('link-mobile-add');
    await expect(mobilePublish).toBeVisible();
    await expect(mobilePublish).toHaveAttribute('href', '/add-listing');
    await mobilePublish.click();
    await expect(page.getByTestId('publish-auth-prompt')).toBeVisible();
  });

  test('opens homepage filters and preserves the search query', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.getByTestId('input-search').fill('جرار');
    await page.getByTestId('button-home-filters').click();

    await expect(page).toHaveURL(/\/listings/);
    const params = new URL(page.url()).searchParams;
    expect(params.get('q')).toBe('جرار');
    expect(params.get('filters')).toBe('open');
    await expect(page.getByTestId('input-search')).toHaveValue('جرار');
    await expect(page.getByText('تصفية النتائج', { exact: true })).toBeVisible();
    const filtersPanel = page.getByTestId('listing-filters-panel');
    await expect(filtersPanel).toBeVisible();

    await page.getByTestId('button-toggle-filters').click();
    await expect(filtersPanel).toBeHidden();
    await page.getByTestId('button-toggle-filters').click();
    await expect(filtersPanel).toBeVisible();
  });

  test('keeps button motion subtle and disables it for reduced-motion users', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');
    const filtersButton = page.getByTestId('button-home-filters');
    await filtersButton.hover();
    await expect.poll(() => filtersButton.evaluate((element) => getComputedStyle(element).scale)).toBe('1.01');

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect.poll(() => filtersButton.evaluate((element) => getComputedStyle(element).scale)).toBe('none');
    expect(await filtersButton.evaluate((element) => getComputedStyle(element).transform)).toBe('none');
  });
});