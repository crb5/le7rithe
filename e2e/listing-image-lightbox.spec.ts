import { expect, test, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const defaultAuthDir = resolve(process.cwd(), 'e2e/.auth');
const sellerStorageState =
  process.env.E2E_SELLER_STORAGE_STATE ?? resolve(defaultAuthDir, 'seller.json');
const baseURL =
  process.env.E2E_BASE_URL ??
  (process.env.REPLIT_DEV_DOMAIN
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : undefined);
const missingConfiguration = !baseURL || !existsSync(sellerStorageState);

const listingId = 901;
const gallery = [
  '/e2e-gallery-image-1.svg',
  '/e2e-gallery-image-2.svg',
  '/e2e-gallery-image-3.svg',
];

const listing = {
  id: listingId,
  title: 'E2E listing photo gallery',
  category: 'Agricultural machinery',
  categorySlug: 'tractors',
  subcategory: null,
  subcategorySlug: null,
  price: 125000,
  currency: 'MRU',
  location: 'Nouakchott',
  condition: 'used' as const,
  year: 2022,
  manufacturer: null,
  model: null,
  hours: null,
  area: null,
  waterAvailable: null,
  electricityAvailable: null,
  ownershipType: null,
  contactPhone: null,
  attributes: {},
  description: 'A listing with several photos used by the lightbox regression.',
  imageUrl: gallery[0],
  images: gallery,
  seller: {
    id: 1,
    name: 'E2E Seller',
    initials: 'ES',
    verified: true,
    phone: null,
  },
  createdAt: new Date().toISOString(),
  expiresAt: null,
  featured: false,
  isSaved: false,
};

async function mockListing(page: Page) {
  await page.route(`**/api/listings/${listingId}`, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(listing),
    });
  });

  await page.route('**/e2e-gallery-image-*.svg', async (route) => {
    const imageNumber = route.request().url().match(/image-(\d)\.svg/)?.[1] ?? '1';
    await route.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      body: `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200"><rect width="320" height="200" fill="${imageNumber === '1' ? '#315c4c' : imageNumber === '2' ? '#c28d3d' : '#477ca5'}"/><text x="160" y="110" text-anchor="middle" fill="white" font-size="32">Photo ${imageNumber}</text></svg>`,
    });
  });
}

async function dismissDevelopmentBanner(page: Page) {
  const closeButton = page.locator('#replit-dev-banner button').first();
  if (await closeButton.count()) {
    await closeButton.click({ force: true });
  }
}

async function swipeLightbox(page: Page, deltaX: number) {
  const viewport = page.getByTestId('listing-image-lightbox-viewport');
  const box = await viewport.boundingBox();
  expect(box).not.toBeNull();

  const client = await page.context().newCDPSession(page);
  const startX = box!.x + box!.width / 2;
  const y = box!.y + box!.height / 2;
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ id: 1, x: startX, y }],
  });
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ id: 1, x: startX + deltaX * 0.5, y }],
  });
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ id: 1, x: startX + deltaX, y }],
  });
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await client.detach();
}

test.describe('listing image lightbox', () => {
  test.skip(
    missingConfiguration,
    'Set E2E_BASE_URL and create the seller storage state with pnpm setup:e2e-auth to run the listing image lightbox regression.',
  );

  test.use({
    storageState: sellerStorageState,
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
  });

  test('opens the selected photo, supports controls and swipes, and restores scroll position', async ({
    page,
  }) => {
    await mockListing(page);
    await page.goto(`/listings/${listingId}`);
    await dismissDevelopmentBanner(page);

    await expect(page.getByTestId('img-detail-main')).toBeVisible();
    await expect(page.getByTestId('button-gallery-1')).toBeVisible();

    await page.evaluate(() => (globalThis as any).scrollTo(0, 120));
    const scrollBeforeOpen = await page.evaluate(() => (globalThis as any).scrollY);
    expect(scrollBeforeOpen).toBeGreaterThan(0);

    await page.getByTestId('button-gallery-1').click();
    const lightbox = page.getByTestId('listing-image-lightbox');
    await expect(lightbox).toBeVisible();
    await expect(page.getByTestId('img-lightbox-active')).toHaveAttribute('src', gallery[1]);
    await expect(lightbox).toContainText('2 / 3');

    await page.getByTestId('button-lightbox-previous').click();
    await expect(page.getByTestId('img-lightbox-active')).toHaveAttribute('src', gallery[0]);
    await expect(lightbox).toContainText('1 / 3');

    await page.getByTestId('button-lightbox-next').click();
    await expect(page.getByTestId('img-lightbox-active')).toHaveAttribute('src', gallery[1]);
    await expect(lightbox).toContainText('2 / 3');

    await swipeLightbox(page, -180);
    await expect(page.getByTestId('img-lightbox-active')).toHaveAttribute('src', gallery[2]);
    await expect(lightbox).toContainText('3 / 3');

    await page.getByTestId('button-close-image-lightbox').click();
    await expect(lightbox).toBeHidden();
    await expect.poll(() => page.evaluate(() => (globalThis as any).scrollY)).toBe(scrollBeforeOpen);
  });
});