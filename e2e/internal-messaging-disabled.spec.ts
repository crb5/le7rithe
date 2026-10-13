import { expect, test } from '@playwright/test';

const baseURL =
  process.env.E2E_BASE_URL ??
  (process.env.REPLIT_DEV_DOMAIN
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : undefined);

test.describe('buyer-seller messaging shutdown', () => {
  test.skip(!baseURL, 'Set E2E_BASE_URL to run the messaging shutdown regression.');

  test('removes conversation navigation and the legacy conversation page', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('a[href="/messages"]')).toHaveCount(0);

    await page.goto('/messages');
    await expect(page.getByTestId('input-message-reply')).toHaveCount(0);
    await expect(page.getByTestId('button-message-reply')).toHaveCount(0);
  });

  test('removes the listing message composer', async ({ page, request }) => {
    const response = await request.get('/api/listings?limit=50');
    expect(response.ok()).toBeTruthy();
    const payload = await response.json() as { items?: Array<{ id: number }> };
    const listingId = payload.items?.[0]?.id;
    test.skip(!listingId, 'No listings are available in this test database.');

    await page.goto(`/listings/${listingId!}`);
    await expect(page).toHaveURL(/\/listings\/\d+$/);
    await expect(page.getByTestId('textarea-message')).toHaveCount(0);
    await expect(page.getByTestId('button-send-message')).toHaveCount(0);
  });

  test('keeps seller phone contact as a telephone link when available', async ({ page, request }) => {
    const response = await request.get('/api/listings?limit=50');
    expect(response.ok()).toBeTruthy();
    const payload = await response.json() as {
      items?: Array<{ id: number; contactPhone?: string | null; saleStatus?: string }>;
    };
    let listingId = payload.items?.find(
      (listing) => listing.contactPhone && listing.saleStatus === 'available',
    )?.id;
    if (!listingId) {
      const details = await Promise.all((payload.items ?? []).map(async ({ id }) => {
        const detailResponse = await request.get(`/api/listings/${id}`);
        if (!detailResponse.ok()) return null;
        return await detailResponse.json() as { id: number; contactPhone?: string | null; saleStatus?: string };
      }));
      listingId = details.find(
        (listing) => listing?.contactPhone && listing.saleStatus === 'available',
      )?.id;
    }
    test.skip(!listingId, 'No active listing with a seller phone number is available in this test database.');

    await page.goto(`/listings/${listingId!}`);
    await expect(page.getByTestId('link-call-seller')).toHaveAttribute('href', /^tel:/);
  });

  test('rejects legacy read, send, and read-status API requests without touching data', async ({ request }) => {
    const responses = await Promise.all([
      request.get('/api/messages'),
      request.post('/api/messages', { data: { listingId: 1, body: 'disabled messaging regression' } }),
      request.patch('/api/messages/1/read'),
    ]);

    for (const response of responses) {
      expect(response.status()).toBe(410);
      expect(response.headers()['cache-control']).toContain('no-store');
    }
  });
});