import {
  expect,
  test,
  type APIRequestContext,
  type BrowserContext,
  type Locator,
  type Page,
} from '@playwright/test';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const defaultAuthDir = resolve(process.cwd(), 'e2e/.auth');
const sellerStorageState =
  process.env.E2E_SELLER_STORAGE_STATE ?? resolve(defaultAuthDir, 'seller.json');
const adminStorageState =
  process.env.E2E_ADMIN_STORAGE_STATE ?? resolve(defaultAuthDir, 'admin.json');
const baseURL =
  process.env.E2E_BASE_URL ??
  (process.env.REPLIT_DEV_DOMAIN
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : undefined);
const missingConfiguration =
  !baseURL || !existsSync(sellerStorageState) || !existsSync(adminStorageState);
const paidListingsEnabled =
  process.env.ENABLE_PAID_LISTINGS?.trim().toLowerCase() === 'true' &&
  process.env.VITE_ENABLE_PAID_LISTINGS?.trim().toLowerCase() === 'true';

const listingImage = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

type JsonResponse = {
  status(): number;
  text(): Promise<string>;
  json(): Promise<unknown>;
};

async function expectJson<T>(response: JsonResponse, status: number): Promise<T> {
  expect(response.status(), await response.text()).toBe(status);
  return (await response.json()) as T;
}

async function expectLoadedImage(locator: Locator) {
  await expect(locator).toBeVisible();
  await expect.poll(async () =>
    locator.evaluate((image) => {
      const element = image as HTMLImageElement;
      return element.complete && element.naturalWidth > 0;
    }),
  ).toBe(true);
}

async function createListingWithImages(page: Page, title: string) {
  await page.goto('/add-listing');
  const uploadResponsesPromise = Promise.all(
    [1, 2, 3].map((index) =>
      page.waitForResponse(
        (response) =>
          response.url().includes('/api/listing-image/uploads/request-url') &&
          response.request().method() === 'POST' &&
          response.request().postDataJSON()?.name === `listing-image-${index}.png`,
      ),
    ),
  );
  await page.getByTestId('input-listing-images').setInputFiles(
    [1, 2, 3].map((index) => ({
      name: `listing-image-${index}.png`,
      mimeType: 'image/png',
      buffer: listingImage,
    })),
  );
  for (const response of await uploadResponsesPromise) {
    expect(response.status()).toBe(200);
  }
  await expect(page.getByTestId('button-submit-listing')).toBeEnabled();
  await expect(page.locator('img[alt^="listing-image-"]')).toHaveCount(3);

  await page.getByTestId('input-listing-title').fill(title);
  await page.getByTestId('select-listing-category').selectOption('tractors');
  await page.getByTestId('select-listing-location').selectOption({ index: 1 });
  await page.getByTestId('input-listing-price').fill('125000');
  await page.getByTestId('input-listing-contact-phone').fill('+222 36 12 45 67');
  await page.getByTestId('textarea-listing-description').fill('Listing image visibility regression test.');

  const listingResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes('/api/listings') &&
      response.request().method() === 'POST',
  );
  await page.getByTestId('button-submit-listing').click();
  const listingResponse = await listingResponsePromise;
  const listing = await expectJson<{
    id: number;
    imageUrl: string;
    images: string[];
    status: string;
  }>(
    listingResponse,
    201,
  );
  await expect(page.getByTestId('payment-confirmation-panel')).toHaveAttribute(
    'data-listing-id',
    String(listing.id),
  );
  expect(listing.imageUrl).toMatch(/^\/api\/listing-images\/[0-9a-f-]{36}$/i);
  expect(listing.images).toHaveLength(3);
  expect(new Set(listing.images).size).toBe(3);
  expect(listing.images[0]).toBe(listing.imageUrl);
  expect(listing.status).toBe('pending_payment');
  return listing;
}

async function submitPayment(page: Page, listingId: number, reference: string) {
  await expect(page.getByTestId('select-payment-package')).toBeVisible();
  await page.getByTestId('select-payment-package').selectOption({ index: 1 });
  await page.getByTestId('select-payment-method').selectOption({ index: 1 });
  await page.getByTestId('input-payment-reference').fill(reference);
  await page.getByTestId('input-payment-date').fill(new Date().toISOString().slice(0, 10));
  await page.getByTestId('input-payment-account-holder').fill('E2E Listing Image Test');
  await page.getByTestId('input-payment-proof').setInputFiles({
    name: 'payment-proof.png',
    mimeType: 'image/png',
    buffer: listingImage,
  });
  const paymentResponsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/payments') &&
      response.request().method() === 'POST',
  );
  await page.getByTestId('button-submit-payment').click();
  return expectJson<{ id: number }>(await paymentResponsePromise, 201);
}

async function confirmAndActivate(
  adminContext: BrowserContext,
  paymentId: number,
  listingId: number,
) {
  await expectJson(
    await adminContext.request.patch(`/api/admin/payments/${paymentId}/status`, {
      data: { status: 'confirmed' },
    }),
    200,
  );
  await expectJson(
    await adminContext.request.patch(`/api/admin/listings/${listingId}/status`, {
      data: { status: 'active' },
    }),
    200,
  );
}

async function evictLocalImageCache(
  request: APIRequestContext,
  originalImageUrl: string,
) {
  const uploadResponse = await request.post('/api/listing-image/uploads/request-url', {
    data: { name: 'cache-fill.png', size: listingImage.length, contentType: 'image/png' },
  });
  const uploadBody = await uploadResponse.json();
  if (
    uploadResponse.status() !== 200 ||
    typeof uploadBody.uploadURL !== 'string' ||
    !uploadBody.uploadURL.includes('/api/listing-image/uploads/local/')
  ) {
    return false;
  }

  for (let index = 0; index < 200; index += 1) {
    const nextUpload = await request.post('/api/listing-image/uploads/request-url', {
      data: {
        name: `cache-fill-${index}.png`,
        size: listingImage.length,
        contentType: 'image/png',
      },
    });
    expect(nextUpload.status()).toBe(200);
    const nextBody = await nextUpload.json();
    const putResponse = await request.put(nextBody.uploadURL, {
      headers: { 'Content-Type': 'image/png' },
      data: listingImage,
    });
    expect(putResponse.status()).toBe(204);
  }

  const imageResponse = await request.get(originalImageUrl);
  expect(imageResponse.status()).toBe(200);
  expect(imageResponse.headers()['content-type']).toContain('image/');
  return true;
}

test.describe('listing image visibility', () => {
  test.skip(
    missingConfiguration,
    'Set E2E_BASE_URL and create seller/admin storage states with yarn setup:e2e-auth to run the listing image regression.',
  );
  test.skip(!paidListingsEnabled, 'This image lifecycle regression includes the temporarily disabled paid-listing flow.');

  test.use({ storageState: sellerStorageState });

  test('shows an uploaded multi-photo gallery after navigation and reload', async ({
    browser,
    page,
  }) => {
    const adminContext = await browser.newContext({ storageState: adminStorageState });
    const adminPage = await adminContext.newPage();
    const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const title = `E2E listing image ${runId}`;

    try {
      const adminMeResponse = await adminContext.request.get('/api/admin/me');
      if (adminMeResponse.status() !== 200) {
        test.skip(
          true,
          'The configured administrator session is unavailable; refresh the Clerk storage state before this regression.',
        );
        return;
      }
      const adminMe = (await adminMeResponse.json()) as { role?: string };
      test.skip(
        adminMe.role !== 'admin',
        'The configured administrator session is not provisioned with a local admin role; run the administrator authorization setup before this regression.',
      );

      const listing = await createListingWithImages(page, title);
      const imageUrls = listing.images;

      await adminPage.goto(`/admin/listings?status=pending_payment`);
      const adminRow = adminPage.locator('tr').filter({ hasText: title });
      await expect(adminRow).toBeVisible();
      await expectLoadedImage(adminRow.locator('img[alt="' + title + '"]'));
      expect(await adminRow.locator('img').getAttribute('src')).toBe(imageUrls[0]);

      const adminImageResponse = await adminContext.request.get(imageUrls[0]);
      expect(adminImageResponse.status()).toBe(200);
      expect(adminImageResponse.headers()['content-type']).toContain('image/');

      await adminPage.goto('/admin');
      const overviewRow = adminPage.locator('div').filter({ hasText: title }).filter({
        has: adminPage.locator(`img[alt="${title}"]`),
      }).last();
      await expect(overviewRow).toBeVisible();
      await expectLoadedImage(overviewRow.locator(`img[alt="${title}"]`));

      const payment = await submitPayment(page, listing.id, `E2E-IMAGE-${runId}`);
      await confirmAndActivate(adminContext, payment.id, listing.id);

      await page.goto(`/listings?q=${encodeURIComponent(title)}`);
      const card = page.getByTestId(`card-listing-${listing.id}`);
      await expect(card).toBeVisible();
      await expectLoadedImage(card.getByTestId(`img-listing-${listing.id}`));

      await page.goto(`/listings/${listing.id}`);
      const galleryThumbnails = page.locator('[data-testid^="button-gallery-"]');
      await expect(galleryThumbnails).toHaveCount(3);
      for (const [index, imageUrl] of imageUrls.entries()) {
        await expectLoadedImage(galleryThumbnails.nth(index).locator('img'));
        await expect(galleryThumbnails.nth(index).locator('img')).toHaveAttribute('src', imageUrl);
      }

      await page.reload();
      await expect(page.getByTestId('img-detail-main')).toBeVisible();
      const reloadedGalleryThumbnails = page.locator('[data-testid^="button-gallery-"]');
      await expect(reloadedGalleryThumbnails).toHaveCount(3);
      for (const [index, imageUrl] of imageUrls.entries()) {
        await expectLoadedImage(reloadedGalleryThumbnails.nth(index).locator('img'));
        await expect(reloadedGalleryThumbnails.nth(index).locator('img')).toHaveAttribute(
          'src',
          imageUrl,
        );
      }

      const persistedAfterCacheEviction = await evictLocalImageCache(
        page.context().request,
        imageUrls[0],
      );
      if (!persistedAfterCacheEviction) {
        const persistedImageResponse = await page.context().request.get(imageUrls[0]);
        expect(persistedImageResponse.status()).toBe(200);
      }
    } finally {
      await adminContext.close();
    }
  });
});