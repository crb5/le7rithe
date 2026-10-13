import { expect, test } from '@playwright/test';
import { resolve } from 'node:path';

const baseURL =
  process.env.E2E_BASE_URL ??
  (process.env.REPLIT_DEV_DOMAIN
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : undefined);
const clerkSecretKey = process.env.CLERK_SECRET_KEY;
const initialAdminPassword = process.env.ADMIN_INITIAL_PASSWORD;
const adminEmail = process.env.E2E_ADMIN_EMAIL ?? 'e2e-admin@example.com';
const sellerEmail = process.env.E2E_SELLER_EMAIL ?? 'e2e-seller@example.com';
const moderatorEmail = process.env.E2E_MODERATOR_EMAIL ?? 'e2e-moderator@example.com';
const sellerStorageState =
  process.env.E2E_SELLER_STORAGE_STATE ?? resolve(process.cwd(), 'e2e/.auth/seller.json');
const configuredAdminUserId =
  process.env.E2E_ADMIN_CLERK_USER_ID ??
  process.env.ADMIN_CLERK_USER_IDS?.split(',').map((value) => value.trim()).find(Boolean);
const missingConfiguration = !baseURL || !clerkSecretKey;
const missingPasswordConfiguration = missingConfiguration || !initialAdminPassword;

const artifactBasePath = baseURL
  ? new URL(baseURL).pathname.replace(/\/$/, '')
  : '';

function artifactRoute(path: string) {
  return `${artifactBasePath}${path}` || path;
}

type ClerkUser = {
  id: string;
  email_addresses?: Array<{ email_address: string }>;
};

type ClerkUsersResponse = {
  data?: ClerkUser[];
};

async function findClerkUserIdByEmail(email: string) {
  const headers = {
    Authorization: `Bearer ${clerkSecretKey}`,
    'Content-Type': 'application/json',
  };
  const usersResponse = await fetch(
    `https://api.clerk.com/v1/users?email_address=${encodeURIComponent(email)}&limit=10`,
    { headers },
  );
  expect(usersResponse.ok, `Could not look up the E2E account (${usersResponse.status}).`).toBeTruthy();
  const usersBody = (await usersResponse.json()) as ClerkUsersResponse | ClerkUser[];
  const users = Array.isArray(usersBody) ? usersBody : usersBody.data ?? [];
  return users.find((user) =>
    user.email_addresses?.some((address) => address.email_address === email),
  )?.id;
}

async function createClerkSignInTicket(userId: string) {
  const headers = {
    Authorization: `Bearer ${clerkSecretKey}`,
    'Content-Type': 'application/json',
  };
  const ticketResponse = await fetch('https://api.clerk.com/v1/sign_in_tokens', {
    method: 'POST',
    headers,
    body: JSON.stringify({ user_id: userId, expires_in_seconds: 600 }),
  });
  expect(ticketResponse.ok, `Could not create a Clerk sign-in ticket (${ticketResponse.status}).`).toBeTruthy();
  const ticket = (await ticketResponse.json()) as { token?: string };
  expect(ticket.token).toBeTruthy();
  return ticket.token!;
}

async function createAdminSignInTicket() {
  const adminId = configuredAdminUserId ?? await findClerkUserIdByEmail(adminEmail);
  expect(adminId, `No Clerk user exists for ${adminEmail}. Run pnpm setup:e2e-auth first.`).toBeTruthy();
  return createClerkSignInTicket(adminId!);
}

async function establishUserClerkSession(page: import('@playwright/test').Page, userId: string) {
  const ticket = await createClerkSignInTicket(userId);
  await page.goto(
    `${artifactRoute('/sign-in')}?__clerk_ticket=${encodeURIComponent(ticket)}`,
    { waitUntil: 'domcontentloaded' },
  );
  await expect.poll(
    async () => (await page.request.get('/api/account/me')).status(),
    { timeout: 30_000 },
  ).toBe(200);
}

async function establishAdminClerkSession(page: import('@playwright/test').Page) {
  const ticket = await createAdminSignInTicket();
  await page.goto(
    `${artifactRoute('/sign-in')}?__clerk_ticket=${encodeURIComponent(ticket)}`,
    { waitUntil: 'domcontentloaded' },
  );
  await expect.poll(
    async () => (await page.request.get('/api/admin/me')).status(),
    { timeout: 30_000 },
  ).toBe(200);
  await page.goto(artifactRoute('/admin/login'), { waitUntil: 'domcontentloaded' });
}

test.describe('admin login route', () => {
  test.skip(
    missingConfiguration,
    'Set E2E_BASE_URL (or REPLIT_DEV_DOMAIN) and CLERK_SECRET_KEY to run the admin login browser regression.',
  );

  test('hides admin routes and APIs from visitors and ordinary users', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const sellerContext = await browser.newContext({ storageState: sellerStorageState });

    try {
      for (const path of ['/admin', '/admin/login', '/admin/users']) {
        await page.goto(artifactRoute(path), { waitUntil: 'domcontentloaded' });
        await expect(page.getByTestId('link-not-found-home')).toBeVisible();
        await expect(page.getByRole('heading', { name: 'بوابة المشرفين' })).toHaveCount(0);
      }

      for (const requestContext of [context.request, sellerContext.request]) {
        for (const [method, path] of [
          ['get', '/api/admin/me'],
          ['get', '/api/admin/overview'],
          ['post', '/api/admin/password/login'],
          ['post', '/api/admin/password/logout'],
          ['get', '/api/admin/categories'],
        ] as const) {
          const response = method === 'get'
            ? await requestContext.get(path)
            : await requestContext.post(path, { data: {} });
          expect(response.status(), `${method.toUpperCase()} ${path}`).toBe(404);
          await expect(response.json()).resolves.toEqual({ error: 'Not found' });
        }
      }
    } finally {
      await sellerContext.close();
      await context.close();
    }
  });

  test.skip(
    missingPasswordConfiguration,
    'Set ADMIN_INITIAL_PASSWORD in addition to the Clerk and base URL configuration to run the password initialization regression.',
  );

  test('logs in and renders the admin overview across languages and screen sizes', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await establishAdminClerkSession(page);

      const initialMeResponse = await page.request.get('/api/admin/me');
      expect(initialMeResponse.ok()).toBeTruthy();
      const initialMe = (await initialMeResponse.json()) as {
        role?: string | null;
        passwordSetupStatus?: 'configured' | 'ready' | 'missing-secret' | 'invalid-secret';
      };
      test.skip(
        initialMe.role !== 'admin',
        'The configured E2E Clerk identity is not allowlisted as an administrator.',
      );
      expect(['configured', 'ready']).toContain(initialMe.passwordSetupStatus);

      await page.getByLabel('كلمة مرور المشرف').fill('Definitely-Wrong9!');
      await page.getByRole('button', { name: 'المتابعة إلى الإدارة' }).click();
      await expect(page.getByTestId('admin-password-error')).toHaveText('كلمة مرور المشرف غير صحيحة.');
      const failedLoginMe = (await (await page.request.get('/api/admin/me')).json()) as {
        adminSessionActive?: boolean;
      };
      expect(failedLoginMe.adminSessionActive).toBe(false);

      await page.getByLabel('كلمة مرور المشرف').fill(initialAdminPassword!);
      await page.getByRole('button', { name: 'المتابعة إلى الإدارة' }).click();
      await page.waitForURL(
        (url) => url.pathname === `${artifactBasePath}/admin`,
        { timeout: 30_000 },
      );
      const successfulLoginMe = (await (await page.request.get('/api/admin/me')).json()) as {
        adminSessionActive?: boolean;
      };
      expect(successfulLoginMe.adminSessionActive).toBe(true);
      await expect(page.getByRole('heading', { name: 'نظرة عامة' })).toBeVisible();

      const overviewResponse = await page.request.get('/api/admin/overview');
      expect(overviewResponse.ok(), await overviewResponse.text()).toBeTruthy();
      const overview = (await overviewResponse.json()) as {
        stats?: { pendingReview?: number; pendingPaymentListings?: number };
        recentOperations?: unknown[];
      };
      expect(typeof overview.stats?.pendingReview).toBe('number');
      expect(typeof overview.stats?.pendingPaymentListings).toBe('number');
      expect(Array.isArray(overview.recentOperations)).toBe(true);

      const localeCases = [
        { language: 'ar', direction: 'rtl', activityHeading: 'أحدث العمليات' },
        { language: 'fr', direction: 'ltr', activityHeading: 'Opérations récentes' },
        { language: 'en', direction: 'ltr', activityHeading: 'Recent operations' },
      ] as const;
      const viewportCases = [
        { width: 1440, height: 1000 },
        { width: 390, height: 844 },
      ];
      for (const viewport of viewportCases) {
        await page.setViewportSize(viewport);
        for (const locale of localeCases) {
          await page.evaluate((language) => {
            window.localStorage.setItem('marketplace-language', language);
          }, locale.language);
          await page.reload({ waitUntil: 'domcontentloaded' });
          await expect(page.locator('html')).toHaveAttribute('lang', locale.language);
          await expect(page.locator('.admin-text-flow')).toHaveAttribute('dir', locale.direction);
          await expect(page.getByRole('heading', { name: locale.activityHeading })).toBeVisible();

          const layout = await page.evaluate(() => ({
            viewportWidth: window.innerWidth,
            documentWidth: document.documentElement.scrollWidth,
            headingWrap: getComputedStyle(document.querySelector('.admin-text-flow h1')!).overflowWrap,
          }));
          expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
          expect(layout.headingWrap).toBe('break-word');
        }
      }

      await page.evaluate(() => {
        window.localStorage.setItem('marketplace-language', 'ar');
      });
      await page.reload({ waitUntil: 'domcontentloaded' });

      const logoutResponse = await page.request.post('/api/admin/password/logout');
      expect(logoutResponse.status()).toBe(204);
      await page.goto(artifactRoute('/admin/login'), { waitUntil: 'domcontentloaded' });
      await expect(page.getByLabel('كلمة مرور المشرف')).toBeVisible();
      await page.getByLabel('كلمة مرور المشرف').fill(initialAdminPassword!);
      await page.getByRole('button', { name: 'المتابعة إلى الإدارة' }).click();
      await page.waitForURL(
        (url) => url.pathname === `${artifactBasePath}/admin`,
        { timeout: 30_000 },
      );
    } finally {
      await context.close();
    }
  });

  test.skip(
    missingPasswordConfiguration,
    'Set ADMIN_INITIAL_PASSWORD in addition to the Clerk and base URL configuration to run the catalog password-boundary regression.',
  );

  test('requires the administrator password before catalog mutations', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await establishAdminClerkSession(page);

      const categoriesResponse = await page.request.get('/api/categories');
      expect(categoriesResponse.status()).toBe(200);
      const categories = (await categoriesResponse.json()) as Array<{
        id: number;
        slug: string;
        name: string;
        nameFr: string;
        nameEn: string;
        icon: string;
        sortOrder: number;
        active: boolean;
        subcategories: Array<{
          id: number;
        }>;
      }>;
      const seededCategory = categories.find((category) => category.slug === 'tractors');
      expect(seededCategory?.id).toBeGreaterThan(0);

      const categoryResponse = await page.request.post('/api/admin/categories', {
        data: {
          name: 'Unauthorized category',
          nameFr: 'Catégorie non autorisée',
          nameEn: 'Unauthorized category',
          slug: `unauthorized-${Date.now()}`,
          icon: 'wheat',
        },
      });
      expect(categoryResponse.status()).toBe(401);
      await expect(categoryResponse.json()).resolves.toEqual({
        error: 'Admin password required',
      });

      const subcategoryResponse = await page.request.post(
        `/api/admin/categories/${seededCategory!.id}/subcategories`,
        {
          data: {
            name: 'Unauthorized subcategory',
            nameFr: 'Sous-catégorie non autorisée',
            nameEn: 'Unauthorized subcategory',
            slug: `unauthorized-subcategory-${Date.now()}`,
          },
        },
      );
      expect(subcategoryResponse.status()).toBe(401);
      await expect(subcategoryResponse.json()).resolves.toEqual({
        error: 'Admin password required',
      });

      const passwordLoginResponse = await page.request.post('/api/admin/password/login', {
        data: { password: initialAdminPassword },
      });
      expect(passwordLoginResponse.status(), await passwordLoginResponse.text()).toBe(200);

      const originalCategory = { ...seededCategory! };
      try {
        const temporaryName = `${originalCategory.name} E2E`;
        const updateResponse = await page.request.patch(
          `/api/admin/categories/${originalCategory.id}`,
          {
            data: {
              name: temporaryName,
              nameFr: originalCategory.nameFr,
              nameEn: originalCategory.nameEn,
              slug: originalCategory.slug,
              icon: originalCategory.icon,
              sortOrder: originalCategory.sortOrder,
              active: originalCategory.active,
            },
          },
        );
        expect(updateResponse.status(), await updateResponse.text()).toBe(200);
        const updatedCategory = (await updateResponse.json()) as { id: number; name: string };
        expect(updatedCategory).toMatchObject({
          id: originalCategory.id,
          name: temporaryName,
        });
      } finally {
        const restoreResponse = await page.request.patch(
          `/api/admin/categories/${originalCategory.id}`,
          {
            data: {
              name: originalCategory.name,
              nameFr: originalCategory.nameFr,
              nameEn: originalCategory.nameEn,
              slug: originalCategory.slug,
              icon: originalCategory.icon,
              sortOrder: originalCategory.sortOrder,
              active: originalCategory.active,
            },
          },
        );
        expect(restoreResponse.status(), await restoreResponse.text()).toBe(200);
      }
    } finally {
      await context.close();
    }
  });

  test.skip(
    missingPasswordConfiguration,
    'Set the Clerk, admin-password, and preview configuration to run the verification badge regression.',
  );

  test('only admins can grant or remove verification and the badge follows the saved state', async ({ browser }) => {
    const guestContext = await browser.newContext();
    const sellerContext = await browser.newContext();
    const moderatorContext = await browser.newContext();
    const adminContext = await browser.newContext();
    const sellerPage = await sellerContext.newPage();
    const moderatorPage = await moderatorContext.newPage();
    const adminPage = await adminContext.newPage();
    let adminSessionReady = false;
    let targetUser: { id: number; role: string; verified: boolean } | null = null;
    let initialVerified: boolean | null = null;
    let adminProfileId: number | null = null;
    let initialAdminVerified: boolean | null = null;
    let targetListing: { id: number; seller: { id: number } } | null = null;
    let sellerProfile: { id: number | null; verified: boolean } | null = null;
    let moderatorSessionReady = false;

    try {
      const sellerUserId = await findClerkUserIdByEmail(sellerEmail);
      if (sellerUserId) {
        await establishUserClerkSession(sellerPage, sellerUserId);
        const sellerProfileResponse = await sellerPage.request.get('/api/account/me');
        if (sellerProfileResponse.ok()) {
          sellerProfile = await sellerProfileResponse.json() as { id: number | null; verified: boolean };
        }
      }

      const moderatorUserId = await findClerkUserIdByEmail(moderatorEmail);
      if (moderatorUserId) {
        await establishUserClerkSession(moderatorPage, moderatorUserId);
        moderatorSessionReady = true;
      }

      await establishAdminClerkSession(adminPage);
      const adminMeResponse = await adminPage.request.get('/api/admin/me');
      expect(adminMeResponse.ok()).toBeTruthy();
      const adminMe = await adminMeResponse.json() as { role?: string | null };
      test.skip(adminMe.role !== 'admin', 'The configured E2E Clerk identity is not allowlisted as an administrator.');

      const loginResponse = await adminPage.request.post('/api/admin/password/login', {
        data: { password: initialAdminPassword },
      });
      expect(loginResponse.status(), await loginResponse.text()).toBe(200);
      adminSessionReady = true;

      const usersResponse = await adminPage.request.get('/api/admin/users');
      expect(usersResponse.ok()).toBeTruthy();
      const users = (await usersResponse.json() as {
        items: Array<{ id: number; role: string; verified: boolean }>;
      }).items;

      const listingResponse = await adminPage.request.get('/api/listings?page=1&limit=50&sort=newest');
      expect(listingResponse.ok()).toBeTruthy();
      const publicListings = (await listingResponse.json() as {
        items: Array<{ id: number; seller: { id: number } }>;
      }).items;
      targetListing = publicListings.find((listing) =>
        users.some((user) => user.id === listing.seller.id && user.role === 'user'),
      ) ?? null;
      targetUser = targetListing
        ? users.find((user) => user.id === targetListing!.seller.id && user.role === 'user') ?? null
        : users.find((user) => user.role === 'user') ?? null;
      test.skip(!targetUser, 'The development database has no regular marketplace user to verify.');
      initialVerified = targetUser!.verified;

      const targetId = targetUser!.id;
      const guestMutation = await guestContext.request.patch(`/api/admin/users/${targetId}/verification`, {
        data: { verified: true },
      });
      expect(guestMutation.status()).toBe(404);

      if (sellerProfile?.id) {
        const sellerSelfMutation = await sellerPage.request.patch(`/api/admin/users/${sellerProfile.id}/verification`, {
          data: { verified: true },
        });
        expect(sellerSelfMutation.status()).toBe(404);
      }

      if (moderatorSessionReady) {
        const moderatorMutation = await moderatorPage.request.patch(`/api/admin/users/${targetId}/verification`, {
          data: { verified: true },
        });
        expect(moderatorMutation.status()).toBe(404);
      }

      await adminPage.goto(artifactRoute('/admin/users'), { waitUntil: 'domcontentloaded' });
      const transitions = initialVerified ? [false, true] : [true, false];
      for (const verified of transitions) {
        await adminPage.getByTestId(`button-user-verification-${targetId}`).click();
        const dialog = adminPage.getByRole('dialog');
        await expect(dialog).toBeVisible();
        await dialog.getByRole('button').last().click();
        await expect(dialog).toHaveCount(0);

        if (verified) {
          await expect(adminPage.getByTestId(`badge-verified-user-${targetId}`)).toBeVisible();
        } else {
          await expect(adminPage.getByTestId(`badge-verified-user-${targetId}`)).toHaveCount(0);
        }

        if (targetListing) {
          await sellerPage.goto(artifactRoute(`/listings/${targetListing.id}`), { waitUntil: 'domcontentloaded' });
          if (verified) {
            await expect(sellerPage.getByTestId(`badge-verified-seller-${targetId}`)).toBeVisible();
          } else {
            await expect(sellerPage.getByTestId(`badge-verified-seller-${targetId}`)).toHaveCount(0);
          }

          await sellerPage.goto(artifactRoute('/listings'), { waitUntil: 'domcontentloaded' });
          if (verified) {
            await expect(sellerPage.getByTestId(`badge-verified-listing-${targetListing.id}`)).toBeVisible();
          } else {
            await expect(sellerPage.getByTestId(`badge-verified-listing-${targetListing.id}`)).toHaveCount(0);
          }
        }

        const auditResponse = await adminPage.request.get('/api/admin/audit-logs');
        expect(auditResponse.ok()).toBeTruthy();
        const auditItems = (await auditResponse.json() as {
          items: Array<{ action: string; resourceId: number | null }>;
        }).items;
        expect(auditItems.some((item) =>
          item.resourceId === targetId && item.action === (verified ? 'user.verified' : 'user.unverified'),
        )).toBeTruthy();
      }

      const adminProfileResponse = await adminPage.request.get('/api/account/me');
      expect(adminProfileResponse.ok()).toBeTruthy();
      const adminProfile = await adminProfileResponse.json() as { id: number | null; verified: boolean };
      expect(adminProfile.id).toBeGreaterThan(0);
      adminProfileId = adminProfile.id;
      initialAdminVerified = adminProfile.verified;
      const accountTransitions = adminProfile.verified ? [false, true] : [true, false];
      for (const verified of accountTransitions) {
        const updateResponse = await adminPage.request.patch(
          `/api/admin/users/${adminProfileId}/verification`,
          { data: { verified } },
        );
        expect(updateResponse.status(), await updateResponse.text()).toBe(200);
        await adminPage.goto(artifactRoute('/account'), { waitUntil: 'domcontentloaded' });
        if (verified) {
          await expect(adminPage.getByTestId('badge-verified-account')).toBeVisible();
        } else {
          await expect(adminPage.getByTestId('badge-verified-account')).toHaveCount(0);
        }
      }
    } finally {
      if (adminSessionReady && targetUser && initialVerified !== null) {
        const restoreResponse = await adminPage.request.patch(
          `/api/admin/users/${targetUser.id}/verification`,
          { data: { verified: initialVerified } },
        );
        expect(restoreResponse.status(), await restoreResponse.text()).toBe(200);
      }
      if (adminSessionReady && adminProfileId !== null && initialAdminVerified !== null) {
        const restoreAdminResponse = await adminPage.request.patch(
          `/api/admin/users/${adminProfileId}/verification`,
          { data: { verified: initialAdminVerified } },
        );
        expect(restoreAdminResponse.status(), await restoreAdminResponse.text()).toBe(200);
      }
      if (adminSessionReady) {
        await adminPage.request.post('/api/admin/password/logout').catch(() => undefined);
      }
      await guestContext.close();
      await sellerContext.close();
      await moderatorContext.close();
      await adminContext.close();
    }
  });
});