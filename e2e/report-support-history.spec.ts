import { expect, test, type BrowserContext } from '@playwright/test';
import { resolve } from 'node:path';

const defaultAuthDir = resolve(process.cwd(), 'e2e/.auth');
const sellerStorageState =
  process.env.E2E_SELLER_STORAGE_STATE ?? resolve(defaultAuthDir, 'seller.json');
const secondSellerStorageState =
  process.env.E2E_SECOND_SELLER_STORAGE_STATE ??
  resolve(defaultAuthDir, 'second-seller.json');
const adminStorageState =
  process.env.E2E_ADMIN_STORAGE_STATE ?? resolve(defaultAuthDir, 'admin.json');
const moderatorStorageState =
  process.env.E2E_MODERATOR_STORAGE_STATE ?? resolve(defaultAuthDir, 'moderator.json');
const baseURL =
  process.env.E2E_BASE_URL ??
  (process.env.REPLIT_DEV_DOMAIN
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : undefined);
const adminPassword = process.env.ADMIN_INITIAL_PASSWORD;

type JsonResponse = {
  status(): number;
  text(): Promise<string>;
  json(): Promise<unknown>;
};

async function expectJson<T>(response: JsonResponse, status: number): Promise<T> {
  expect(response.status(), await response.text()).toBe(status);
  return (await response.json()) as T;
}

type AdminNotification = {
  id: number;
  listingId: number | null;
  reportId: number | null;
  type: 'admin_new_listing' | 'admin_new_report';
  read: boolean;
};

type AdminNotificationResponse = {
  items: AdminNotification[];
  unreadCount: number;
  unreadCounts: { all: number; listings: number; reports: number };
};

async function getAdminNotifications(
  context: BrowserContext,
  filter: 'all' | 'listings' | 'reports',
) {
  return expectJson<AdminNotificationResponse>(
    await context.request.get(`/api/admin/notifications?filter=${filter}`),
    200,
  );
}

test.describe('listing reports and support history', () => {
  test.skip(
    !baseURL || !adminPassword,
    'Set E2E_BASE_URL or REPLIT_DEV_DOMAIN and ADMIN_INITIAL_PASSWORD to run this regression.',
  );

  test('keeps report history private while allowing administrator replies', async ({ browser }) => {
    const sellerContext = await browser.newContext({ storageState: sellerStorageState });
    const secondSellerContext = await browser.newContext({
      storageState: secondSellerStorageState,
    });
    const adminContext = await browser.newContext({ storageState: adminStorageState });
    const sellerPage = await sellerContext.newPage();
    const secondSellerPage = await secondSellerContext.newPage();
    const adminPage = await adminContext.newPage();
    const reportDetails = `E2E report ownership boundary ${Date.now()}`;
    const adminReply = `E2E administrator reply ${Date.now()}`;

    try {
      const listings = await expectJson<{
        items: Array<{ id: number; title: string }>;
      }>(await sellerContext.request.get('/api/listings?limit=1'), 200);
      expect(listings.items.length).toBeGreaterThan(0);
      const listing = listings.items[0];

      await sellerPage.goto(`/listings/${listing.id}`);
      await sellerPage.getByTestId('button-report-listing').click();
      const reportForm = sellerPage.locator('textarea:not([data-testid="textarea-message"])').locator('..');
      await expect(reportForm).toBeVisible();
      await reportForm.locator('textarea').fill(reportDetails);

      const createReportResponsePromise = sellerPage.waitForResponse(
        (response) =>
          response.url().endsWith('/api/reports') &&
          response.request().method() === 'POST',
      );
      await reportForm.getByRole('button').last().click();
      const report = await expectJson<{ id: number; details: string }>(
        await createReportResponsePromise,
        201,
      );
      expect(report.details).toBe(reportDetails);

      const reportHistoryResponsePromise = sellerPage.waitForResponse(
        (response) =>
          response.url().endsWith('/api/reports') &&
          response.request().method() === 'GET',
      );
      await sellerPage.goto('/support');
      await expectJson<{
        items: Array<{ id: number; details: string }>;
      }>(await reportHistoryResponsePromise, 200);
      const reportHistoryLink = sellerPage.locator(`a[href="/reports/${report.id}"]`);
      await expect(reportHistoryLink).toBeVisible();
      await expect(reportHistoryLink).toContainText(reportDetails);

      const reportDetailsResponsePromise = sellerPage.waitForResponse(
        (response) =>
          response.url().endsWith(`/api/reports/${report.id}`) &&
          response.request().method() === 'GET',
      );
      await reportHistoryLink.click();
      await expect(sellerPage).toHaveURL(new RegExp(`/reports/${report.id}$`));
      await expectJson<{ id: number; details: string }>(
        await reportDetailsResponsePromise,
        200,
      );
      await expect(sellerPage.getByText(reportDetails, { exact: true })).toBeVisible();

      await adminPage.goto('/admin/login');
      const adminPasswordResponse = await adminContext.request.post(
        '/api/admin/password/login',
        { data: { password: adminPassword } },
      );
      expect(adminPasswordResponse.status(), await adminPasswordResponse.text()).toBe(200);

      const unauthorizedReportResponsePromise = secondSellerPage.waitForResponse(
        (response) =>
          response.url().endsWith(`/api/reports/${report.id}`) &&
          response.request().method() === 'GET',
      );
      await secondSellerPage.goto(`/reports/${report.id}`);
      const unauthorizedBody = await expectJson<{ error: string }>(
        await unauthorizedReportResponsePromise,
        404,
      );
      expect(unauthorizedBody).toEqual({ error: 'Report not found' });
      await expect(secondSellerPage.getByText(reportDetails, { exact: true })).toHaveCount(0);

      const adminReportsResponsePromise = adminPage.waitForResponse(
        (response) =>
          response.url().endsWith('/api/admin/reports') &&
          response.request().method() === 'GET',
      );
      await adminPage.goto('/admin/reports');
      await expectJson<{ items: Array<{ id: number; details: string }> }>(
        await adminReportsResponsePromise,
        200,
      );

      const reportRow = adminPage.locator('tbody tr').filter({ hasText: reportDetails });
      await expect(reportRow).toBeVisible();
      await reportRow.locator('button').last().click();
      const replyDialog = adminPage.getByRole('dialog');
      await expect(replyDialog).toBeVisible();
      await replyDialog.locator('textarea').fill(adminReply);

      const replyResponsePromise = adminPage.waitForResponse(
        (response) =>
          response.url().endsWith(`/api/admin/reports/${report.id}`) &&
          response.request().method() === 'PATCH',
      );
      await replyDialog.getByRole('button').last().click();
      const updatedReport = await expectJson<{ status: string; action: string }>(
        await replyResponsePromise,
        200,
      );
      expect(updatedReport).toMatchObject({ status: 'resolved', action: adminReply });

      await sellerPage.goto(`/reports/${report.id}`);
      await expect(sellerPage.getByText(adminReply, { exact: true })).toBeVisible();
    } finally {
      await sellerContext.close();
      await secondSellerContext.close();
      await adminContext.close();
    }
  });

  test('routes report alerts to the matching report and keeps read ownership isolated', async ({
    browser,
  }) => {
    const sellerContext = await browser.newContext({ storageState: sellerStorageState });
    const adminContext = await browser.newContext({ storageState: adminStorageState });
    const moderatorContext = await browser.newContext({ storageState: moderatorStorageState });
    const sellerPage = await sellerContext.newPage();
    const adminPage = await adminContext.newPage();
    const moderatorPage = await moderatorContext.newPage();
    const reportDetails = `E2E report notification ownership ${Date.now()}`;

    try {
      const listings = await expectJson<{
        items: Array<{ id: number }>;
      }>(await sellerContext.request.get('/api/listings?limit=1'), 200);
      expect(listings.items.length).toBeGreaterThan(0);
      const listing = listings.items[0];

      await sellerPage.goto(`/listings/${listing.id}`);
      await sellerPage.getByTestId('button-report-listing').click();
      const reportForm = sellerPage.locator('textarea:not([data-testid="textarea-message"])').locator('..');
      await expect(reportForm).toBeVisible();
      await reportForm.locator('textarea').fill(reportDetails);

      const createReportResponsePromise = sellerPage.waitForResponse(
        (response) =>
          response.url().endsWith('/api/reports') &&
          response.request().method() === 'POST',
      );
      await reportForm.getByRole('button').last().click();
      const report = await expectJson<{ id: number }>(
        await createReportResponsePromise,
        201,
      );

      await adminPage.goto('/admin/login');
      const adminPasswordResponse = await adminContext.request.post('/api/admin/password/login', {
        data: { password: adminPassword },
      });
      expect(adminPasswordResponse.status(), await adminPasswordResponse.text()).toBe(200);
      const moderatorPasswordResponse = await moderatorContext.request.post('/api/admin/password/login', {
        data: { password: adminPassword },
      });
      await expectJson<{ error: string }>(moderatorPasswordResponse, 404);
      await moderatorPage.goto('/admin');
      await expect(moderatorPage.getByTestId('link-not-found-home')).toBeVisible();

      const adminNotifications = await expectJson<{
        items: Array<{
          id: number;
          reportId: number | null;
          type: string;
          read: boolean;
        }>;
        unreadCount: number;
      }>(await adminContext.request.get('/api/admin/notifications'), 200);
      const adminNotification = adminNotifications.items.find(
        (notification) =>
          notification.type === 'admin_new_report' && notification.reportId === report.id,
      );
      expect(adminNotification).toBeDefined();
      expect(adminNotification?.read).toBe(false);

      await expectJson<{ error: string }>(
        await moderatorContext.request.get('/api/admin/notifications'),
        404,
      );

      const unauthorizedReadResponse = await moderatorContext.request.patch(
        `/api/admin/notifications/${adminNotification?.id}/read`,
      );
      await expectJson<{ error: string }>(unauthorizedReadResponse, 404);
      await expect(unauthorizedReadResponse.json()).resolves.toEqual({ error: 'Not found' });

      const stillUnread = await expectJson<{
        items: Array<{ id: number; reportId: number | null; read: boolean }>;
      }>(await adminContext.request.get('/api/admin/notifications'), 200);
      expect(
        stillUnread.items.find((notification) => notification.id === adminNotification?.id),
      ).toMatchObject({ reportId: report.id, read: false });

      const feedResponsePromise = adminPage.waitForResponse(
        (response) =>
          response.url().endsWith('/api/admin/notifications') &&
          response.request().method() === 'GET',
      );
      await adminPage.goto('/admin/notifications');
      expect((await feedResponsePromise).status()).toBe(200);
      const notificationCard = adminPage.getByTestId(`admin-notification-${adminNotification?.id}`);
      await expect(notificationCard).toBeVisible();

      const markReadResponsePromise = adminPage.waitForResponse(
        (response) =>
          response.url().endsWith(`/api/admin/notifications/${adminNotification?.id}/read`) &&
          response.request().method() === 'PATCH',
      );
      await notificationCard.click();
      expect((await markReadResponsePromise).status()).toBe(200);
      await expect(adminPage).toHaveURL(new RegExp(`/admin/reports\\?reportId=${report.id}$`));
      await expect(adminPage.locator(`#admin-report-${report.id}`)).toBeVisible();

      const afterOpen = await expectJson<{
        items: Array<{ id: number; reportId: number | null; read: boolean }>;
      }>(await adminContext.request.get('/api/admin/notifications'), 200);
      expect(
        afterOpen.items.find((notification) => notification.id === adminNotification?.id),
      ).toMatchObject({ reportId: report.id, read: true });

      const secondUnauthorizedReadResponse = await moderatorContext.request.patch(
        `/api/admin/notifications/${adminNotification?.id}/read`,
      );
      await expectJson<{ error: string }>(secondUnauthorizedReadResponse, 404);
      await expect(secondUnauthorizedReadResponse.json()).resolves.toEqual({ error: 'Not found' });
      const unchangedAfterSecondAttempt = await expectJson<{
        items: Array<{ id: number; reportId: number | null; read: boolean }>;
      }>(await adminContext.request.get('/api/admin/notifications'), 200);
      expect(
        unchangedAfterSecondAttempt.items.find(
          (notification) => notification.id === adminNotification?.id,
        ),
      ).toMatchObject({ reportId: report.id, read: true });
    } finally {
      await sellerContext.close();
      await adminContext.close();
      await moderatorContext.close();
    }
  });

  test('keeps listing and report alert filters scoped to each administrator', async ({ browser }) => {
    const sellerContext = await browser.newContext({ storageState: sellerStorageState });
    const adminContext = await browser.newContext({ storageState: adminStorageState });
    const moderatorContext = await browser.newContext({ storageState: moderatorStorageState });
    const adminPage = await adminContext.newPage();
    const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const listingTitle = `E2E filtered listing alert ${runId}`;

    try {
      const listing = await expectJson<{ id: number }>(
        await sellerContext.request.post('/api/listings', {
          data: {
            title: listingTitle,
            category: 'tractors',
            price: 125000,
            currency: 'MRU',
            location: 'Nouakchott',
            condition: 'used',
            description: 'Listing created for notification filter regression coverage.',
            contactPhone: '+222 36 12 45 67',
          },
        }),
        201,
      );
      const report = await expectJson<{ id: number }>(
        await sellerContext.request.post('/api/reports', {
          data: {
            listingId: listing.id,
            reason: 'other',
            details: `E2E report alert filter ownership ${runId}`,
          },
        }),
        201,
      );

      await adminPage.goto('/admin/login');
      const adminPasswordResponse = await adminContext.request.post('/api/admin/password/login', {
        data: { password: adminPassword },
      });
      expect(adminPasswordResponse.status(), await adminPasswordResponse.text()).toBe(200);
      const moderatorPasswordResponse = await moderatorContext.request.post('/api/admin/password/login', {
        data: { password: adminPassword },
      });
      await expectJson<{ error: string }>(moderatorPasswordResponse, 404);

      const adminByFilter = {
        all: await getAdminNotifications(adminContext, 'all'),
        listings: await getAdminNotifications(adminContext, 'listings'),
        reports: await getAdminNotifications(adminContext, 'reports'),
      };
      for (const filter of ['all', 'listings', 'reports']) {
        await expectJson<{ error: string }>(
          await moderatorContext.request.get(`/api/admin/notifications?filter=${filter}`),
          404,
        );
      }
      const adminListing = adminByFilter.listings.items.find(
        (notification) =>
          notification.type === 'admin_new_listing' && notification.listingId === listing.id,
      );
      const adminReport = adminByFilter.reports.items.find(
        (notification) =>
          notification.type === 'admin_new_report' && notification.reportId === report.id,
      );

      expect(adminListing).toMatchObject({ listingId: listing.id, read: false });
      expect(adminReport).toMatchObject({ reportId: report.id, read: false });

      expect(adminByFilter.listings.items.every((item) => item.type === 'admin_new_listing')).toBe(true);
      expect(adminByFilter.reports.items.every((item) => item.type === 'admin_new_report')).toBe(true);
      expect(adminByFilter.all.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: adminListing?.id, listingId: listing.id }),
          expect.objectContaining({ id: adminReport?.id, reportId: report.id }),
        ]),
      );
      const listingsUnreadBeforeRead = adminByFilter.listings.unreadCounts.listings;
      const reportsUnreadBeforeRead = adminByFilter.reports.unreadCounts.reports;
      expect(listingsUnreadBeforeRead).toBeGreaterThan(0);
      expect(reportsUnreadBeforeRead).toBeGreaterThan(0);

      const markListingRead = await adminContext.request.patch(
        `/api/admin/notifications/${adminListing?.id}/read`,
      );
      expect(markListingRead.status(), await markListingRead.text()).toBe(200);
      const listingsAfterRead = await getAdminNotifications(adminContext, 'listings');
      expect(listingsAfterRead.unreadCounts.listings).toBe(listingsUnreadBeforeRead - 1);
      expect(
        listingsAfterRead.items.find((notification) => notification.id === adminListing?.id),
      ).toMatchObject({ listingId: listing.id, read: true });

      await adminPage.goto('/admin/notifications?filter=all');
      await adminPage.getByTestId('admin-notification-filter-listings').click();
      await expect(adminPage).toHaveURL(/\/admin\/notifications\?filter=listings$/);
      await adminPage.reload();
      await expect(adminPage.getByTestId(`admin-notification-${adminListing?.id}`)).toBeVisible();
      expect((await getAdminNotifications(adminContext, 'listings')).unreadCounts.listings).toBe(
        listingsUnreadBeforeRead - 1,
      );

      const markReportRead = await adminContext.request.patch(
        `/api/admin/notifications/${adminReport?.id}/read`,
      );
      expect(markReportRead.status(), await markReportRead.text()).toBe(200);
      const reportsAfterRead = await getAdminNotifications(adminContext, 'reports');
      expect(reportsAfterRead.unreadCounts.reports).toBe(reportsUnreadBeforeRead - 1);
      expect(
        reportsAfterRead.items.find((notification) => notification.id === adminReport?.id),
      ).toMatchObject({ reportId: report.id, read: true });

      await adminPage.getByTestId('admin-notification-filter-reports').click();
      await expect(adminPage).toHaveURL(/\/admin\/notifications\?filter=reports$/);
      await adminPage.reload();
      await expect(adminPage.getByTestId(`admin-notification-${adminReport?.id}`)).toBeVisible();
      expect((await getAdminNotifications(adminContext, 'reports')).unreadCounts.reports).toBe(
        reportsUnreadBeforeRead - 1,
      );
    } finally {
      await sellerContext.close();
      await adminContext.close();
      await moderatorContext.close();
    }
  });
});