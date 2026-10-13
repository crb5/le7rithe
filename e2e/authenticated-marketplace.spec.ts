import { expect, test } from '@playwright/test';
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

const isMarketplaceApiRequest = (url: string) => url.includes('/api/');

test.describe('authenticated marketplace requests', () => {
  test.skip(
    missingConfiguration,
    'Set E2E_BASE_URL and create the seller storage state with pnpm setup:e2e-auth to run the authenticated marketplace regression.',
  );

  test.use({ storageState: sellerStorageState });

  test('loads market data and uploads listing images with the signed-in session', async ({ page }) => {
    const unauthorizedResponses: string[] = [];
    page.on('response', (response) => {
      if (isMarketplaceApiRequest(response.url()) && response.status() === 401) {
        unauthorizedResponses.push(`${response.request().method()} ${response.url()}`);
      }
    });

    const categoryResponsePromise = page.waitForResponse(
      (response) => response.url().endsWith('/api/categories') && response.request().method() === 'GET',
    );
    const locationResponsePromise = page.waitForResponse(
      (response) => response.url().endsWith('/api/locations') && response.request().method() === 'GET',
    );
    const listingResponsePromise = page.waitForResponse(
      (response) => response.url().includes('/api/listings') && response.request().method() === 'GET',
    );

    await page.goto('/');

    const [categoryResponse, locationResponse, listingResponse] = await Promise.all([
      categoryResponsePromise,
      locationResponsePromise,
      listingResponsePromise,
    ]);
    for (const response of [categoryResponse, locationResponse, listingResponse]) {
      expect(response.status(), `${response.request().method()} ${response.url()}`).toBe(200);
      expect(response.request().headers().authorization).toMatch(/^Bearer \S+$/);
    }
    expect(unauthorizedResponses).toEqual([]);
    await expect(page.getByTestId('link-category-tractors')).toBeVisible();

    const uploadRequestPromise = page.waitForRequest(
      (request) =>
        request.url().endsWith('/api/listing-image/uploads/request-url') &&
        request.method() === 'POST',
    );
    const uploadResponsePromise = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/listing-image/uploads/request-url') &&
        response.request().method() === 'POST',
    );

    await page.goto('/add-listing');
    await page.getByTestId('input-listing-images').setInputFiles({
      name: 'listing-image.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
        'base64',
      ),
    });

    const uploadRequest = await uploadRequestPromise;
    const uploadResponse = await uploadResponsePromise;
    expect(uploadRequest.headers().authorization).toMatch(/^Bearer \S+$/);
    expect(uploadResponse.status()).not.toBe(401);
    expect(unauthorizedResponses).toEqual([]);
  });
});