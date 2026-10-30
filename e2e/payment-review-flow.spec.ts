import { expect, request, test, type BrowserContext, type Page, type Request, type Response } from '@playwright/test';
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
const secondaryAdminStorageState =
  process.env.E2E_SECONDARY_ADMIN_STORAGE_STATE ?? resolve(defaultAuthDir, 'admin-secondary.json');
const paidListingsEnabled =
  process.env.ENABLE_PAID_LISTINGS?.trim().toLowerCase() === 'true' &&
  process.env.VITE_ENABLE_PAID_LISTINGS?.trim().toLowerCase() === 'true';
const adminInitialPassword = process.env.ADMIN_INITIAL_PASSWORD;

const proofPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

async function selectMarketplaceLanguage(page: Page, language: 'ar' | 'fr' | 'en') {
  const selector = page.getByTestId('select-language');
  await selector.click();
  await page.getByTestId(`language-option-${language}`).click();
  await expect(selector).toHaveAttribute('data-language', language);
}

type PaymentOptions = {
  packages: Array<{
    id: number;
    name: string;
    price: string;
    currency: string;
    durationDays: number;
    featured: boolean;
    pinned: boolean;
  }>;
  methods: Array<{ id: number; name: string }>;
};

type Payment = {
  id: number;
  listingId: number;
  amount: string;
  currency: string;
  status: string;
  transactionReference: string;
  package?: { id: number; name: string; price: string; currency: string } | null;
  method?: { id: number; name: string } | null;
};

type Listing = {
  id: number;
  title: string;
  status?: string;
  featured?: boolean;
  expiresAt?: string | null;
  contactPhone?: string | null;
  price?: number;
};

type Notification = {
  id: number;
  listingId: number | null;
  title: string;
  type: string;
  body: string;
  read: boolean;
  createdAt: string;
};

type JsonResponse = {
  status(): number;
  text(): Promise<string>;
  json(): Promise<unknown>;
};

const expectedPaymentProofStorage = process.env.E2E_PAYMENT_PROOF_STORAGE;
if (
  expectedPaymentProofStorage !== undefined &&
  expectedPaymentProofStorage !== 'local' &&
  expectedPaymentProofStorage !== 'private'
) {
  throw new Error('E2E_PAYMENT_PROOF_STORAGE must be "local" or "private" when provided.');
}

async function expectJson<T>(response: JsonResponse, status: number): Promise<T> {
  expect(response.status(), await response.text()).toBe(status);
  return (await response.json()) as T;
}

async function createListing(
  page: Page,
  title: string,
  contactPhone = '+222 36 12 45 67',
): Promise<Listing> {
  await page.goto('/add-listing');
  await page.getByTestId('input-listing-title').fill(title);
  const categorySelect = page.getByTestId('select-listing-category');
  await categorySelect.selectOption('land');
  await expect(page.getByTestId('category-field-area')).toBeVisible();
  await expect(page.getByTestId('category-field-waterAvailable')).toHaveValue('');
  await expect(page.getByTestId('category-field-electricityAvailable')).toHaveValue('');
  await expect(page.getByTestId('category-field-ownershipType')).toBeVisible();
  await page.getByTestId('category-field-area').fill('18');
  await page.getByTestId('category-field-waterAvailable').selectOption('yes');
  await page.getByTestId('category-field-electricityAvailable').selectOption('no');
  await expect(page.getByTestId('category-field-waterAvailable')).toHaveValue('yes');
  await expect(page.getByTestId('category-field-electricityAvailable')).toHaveValue('no');
  await page.getByTestId('category-field-ownershipType').fill('private');
  await page.getByTestId('category-field-landCondition').selectOption('reclaimed');
  await page.getByTestId('category-field-region').selectOption({ index: 1 });
  await categorySelect.selectOption('tractors');
  for (const field of [
    'area',
    'waterAvailable',
    'electricityAvailable',
    'ownershipType',
    'landCondition',
    'region',
    'customRegion',
  ]) {
    await expect(page.getByTestId(`category-field-${field}`)).toHaveCount(0);
  }
  await page.getByTestId('select-listing-location').selectOption({ index: 1 });
  await page.getByTestId('input-listing-price').fill('125000');
  await page.getByTestId('input-listing-contact-phone').fill(contactPhone);
  await page.getByTestId('textarea-listing-description').fill('Authenticated payment review flow test listing.');
  const listingResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes('/api/listings') &&
      response.request().method() === 'POST',
  );
  await page.getByTestId('button-submit-listing').click();
  const listingResponse = await listingResponsePromise;
  expect(listingResponse.status()).toBe(201);
  const submittedListing = listingResponse.request().postDataJSON() as Record<string, unknown>;
  expect(submittedListing).toMatchObject({
    category: 'tractors',
    area: null,
    waterAvailable: null,
    electricityAvailable: null,
    ownershipType: null,
  });
  const attributes = submittedListing.attributes as Record<string, unknown>;
  for (const field of ['landCondition', 'region', 'customRegion']) {
    expect(attributes).not.toHaveProperty(field);
  }
  const createdListing = (await listingResponse.json()) as Listing;
  expect(createdListing.id).toBeGreaterThan(0);
  const listing = { id: createdListing.id, title } satisfies Listing;
  if (paidListingsEnabled) {
    const listingId = await page
      .getByTestId('payment-confirmation-panel')
      .getAttribute('data-listing-id');
    expect(listingId).toBe(String(createdListing.id));
    await expect(page.getByTestId('select-payment-package')).toBeVisible();
  } else {
    await expect(page.getByTestId('payment-confirmation-panel')).toHaveCount(0);
    await expect(page).toHaveURL(/\/dashboard$/);
  }
  expect(listing.title).toBe(title);
  await expectJson(await page.context().request.get(`/api/listings/${listing.id}`), 404);
  return listing;
}

async function submitPayment(page: Page, listing: Listing, reference: string): Promise<Payment> {
  const optionsResponse = await page.context().request.get('/api/payment-options');
  const options = await expectJson<PaymentOptions>(optionsResponse, 200);
  const paymentPackage =
    options.packages.find((item) => item.featured && !item.pinned) ??
    options.packages.find((item) => item.featured);
  const paymentMethod = options.methods[0];
  if (!paymentPackage) throw new Error('No featured payment package is configured');
  if (!paymentMethod) throw new Error('No payment method is configured');

  await page.getByTestId('select-payment-package').selectOption(String(paymentPackage.id));
  await page.getByTestId('select-payment-method').selectOption(String(paymentMethod.id));
  await page.getByTestId('input-payment-reference').fill(reference);
  await page.getByTestId('input-payment-account-holder').fill('Payment Flow Test User');
  await page.getByTestId('input-payment-proof').setInputFiles({
    name: `${reference}.png`,
    mimeType: 'image/png',
    buffer: proofPng,
  });

  const pageOrigin = new URL(page.url()).origin;
  const paymentProofUploadRequests: Array<{ url: string; headers: Record<string, string> }> = [];
  const paymentProofUploadResponses: Array<{ url: string; status: number }> = [];
  const recordPaymentProofUploadRequest = (request: Request) => {
    if (request.method() === 'PUT' && request.headers()['content-type'] === 'image/png') {
      paymentProofUploadRequests.push({ url: request.url(), headers: request.headers() });
    }
  };
  const recordPaymentProofUploadResponse = (response: Response) => {
    if (response.request().method() === 'PUT' && response.request().headers()['content-type'] === 'image/png') {
      paymentProofUploadResponses.push({ url: response.url(), status: response.status() });
    }
  };
  page.on('request', recordPaymentProofUploadRequest);
  page.on('response', recordPaymentProofUploadResponse);
  const proofUploadResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes('/api/payment-proof/uploads/request-url') &&
      response.request().method() === 'POST',
  );
  const proofUploadRequestPromise = page.waitForRequest(
    (request) =>
      request.url().includes('/api/payment-proof/uploads/request-url') &&
      request.method() === 'POST',
  );
  const proofFileUploadResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'PUT' &&
      response.request().headers()['content-type'] === 'image/png',
  );
  try {
    await page.getByTestId('button-submit-payment').click();
    const proofUploadRequest = await proofUploadRequestPromise;
    expect(proofUploadRequest.headers().authorization, 'Payment proof request-url must include the bearer token').toMatch(/^Bearer \S+$/);
    const proofUploadResponse = await proofUploadResponsePromise;
    const proofUpload = await expectJson<{
      uploadURL: string;
      objectPath: string;
    }>(proofUploadResponse, 200);
    expect(proofUploadResponse.status(), 'Payment proof request-url must not be rejected as unauthorized').not.toBe(401);
    expect(proofUpload.objectPath).toMatch(
      /^\/objects\/uploads\/[0-9a-f-]{36}\.[A-Za-z0-9_-]{43}$/i,
    );
    expect(
      proofUpload.uploadURL.startsWith('/api/payment-proof/uploads/local/') ||
        proofUpload.uploadURL.startsWith('https://'),
    ).toBe(true);

    const resolvedUploadURL = new URL(proofUpload.uploadURL, pageOrigin).toString();
    const proofStorage =
      new URL(resolvedUploadURL).origin === pageOrigin ? 'local' : 'private';
    if (expectedPaymentProofStorage) {
      expect(proofStorage).toBe(expectedPaymentProofStorage);
    }
    expect(proofUpload.objectPath).not.toMatch(/^https?:\/\//);
    const proofFileUploadResponse = await proofFileUploadResponsePromise;
    expect(proofFileUploadResponse.url()).toBe(resolvedUploadURL);
    const proofFileUpload = paymentProofUploadRequests.find((request) => request.url === resolvedUploadURL);
    const recordedProofFileUploadResponse = paymentProofUploadResponses.find((response) => response.url === resolvedUploadURL);
    expect(proofFileUpload, 'Payment proof file upload request was not sent').toBeDefined();
    expect(recordedProofFileUploadResponse, 'Payment proof file upload response was not received').toBeDefined();
    expect(proofFileUploadResponse.status(), 'Payment proof file upload must not be rejected as unauthorized').not.toBe(401);
    if (new URL(resolvedUploadURL).origin === pageOrigin) {
      expect(proofFileUpload!.headers.authorization, 'Same-origin payment proof upload must include the bearer token').toMatch(/^Bearer \S+$/);
    }

    await expect(page).toHaveURL(/\/dashboard$/);
  } finally {
    page.off('request', recordPaymentProofUploadRequest);
    page.off('response', recordPaymentProofUploadResponse);
  }

  const paymentsResponse = await page.context().request.get('/api/payments/mine');
  const payments = await expectJson<{ items: Payment[] }>(paymentsResponse, 200);
  const payment = payments.items.find((item) => item.transactionReference === reference);
  expect(payment, `Could not find payment "${reference}"`).toBeTruthy();
  expect(payment!.listingId).toBe(listing.id);
  expect(payment!.status).toBe('pending');
  expect(payment!.package?.id).toBe(paymentPackage.id);
  expect(payment!.method?.id).toBe(paymentMethod.id);
  return payment!;
}

async function uploadPaymentProof(context: BrowserContext): Promise<string> {
  const uploadResponse = await context.request.post('/api/payment-proof/uploads/request-url', {
    data: {
      name: 'reused-proof.png',
      size: proofPng.length,
      contentType: 'image/png',
    },
  });
  const upload = await expectJson<{ uploadURL: string; objectPath: string }>(
    uploadResponse,
    200,
  );
  const fileResponse = await context.request.put(upload.uploadURL, {
    data: proofPng,
    headers: { 'content-type': 'image/png' },
  });
  expect(fileResponse.status(), await fileResponse.text()).toBeLessThan(300);
  return upload.objectPath;
}

async function submitPaymentWithProof(
  context: BrowserContext,
  listing: Listing,
  proofObjectPath: string,
  reference: string,
): Promise<JsonResponse> {
  const options = await expectJson<PaymentOptions>(
    await context.request.get('/api/payment-options'),
    200,
  );
  const paymentPackage =
    options.packages.find((item) => item.featured && !item.pinned) ??
    options.packages.find((item) => item.featured);
  const paymentMethod = options.methods[0];
  if (!paymentPackage) throw new Error('No featured payment package is configured');
  if (!paymentMethod) throw new Error('No payment method is configured');

  return context.request.post('/api/payments', {
    data: {
      listingId: listing.id,
      packageId: paymentPackage.id,
      paymentMethodId: paymentMethod.id,
      amount: Number(paymentPackage.price),
      transactionReference: reference,
      transactionDate: new Date().toISOString(),
      accountHolderName: 'Payment Proof Ownership Test',
      proofObjectPath,
    },
  });
}

const featuredHeadings = {
  ar: 'إعلانات تستحق المشاهدة',
  fr: 'Des annonces à découvrir',
  en: 'Listings worth a look',
} as const;

async function expectFeaturedListingOnHome(
  page: Page,
  title: string,
  language: keyof typeof featuredHeadings,
  visible: boolean,
) {
  const featuredResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes('/api/listings') &&
      response.url().includes('featured=true') &&
      response.request().method() === 'GET',
  );
  await page.goto('/');
  expect((await featuredResponsePromise).status()).toBe(200);
  await selectMarketplaceLanguage(page, language);

  const featuredSection = page.getByTestId('section-featured-listings');
  await expect(
    featuredSection.getByRole('heading', { name: featuredHeadings[language] }),
  ).toBeVisible();
  const listingTitle = featuredSection.getByText(title, { exact: true });
  if (visible) {
    await expect(listingTitle).toBeVisible();
  } else {
    await expect(listingTitle).toHaveCount(0);
  }
}

async function getListing(context: BrowserContext, title: string): Promise<Listing> {
  const response = await context.request.get(`/api/admin/listings?q=${encodeURIComponent(title)}`);
  const body = await expectJson<{ items: Listing[] }>(response, 200);
  const listing = body.items.find((item) => item.title === title);
  expect(listing, `Could not find admin listing "${title}"`).toBeTruthy();
  return listing!;
}

async function getPaymentProofAudits(
  context: BrowserContext,
  paymentId: number,
): Promise<Array<{ action: string; resourceId: number | null; actorOidcSubject: string | null }>> {
  const response = await context.request.get('/api/admin/audit-logs');
  const body = await expectJson<{
    items: Array<{ action: string; resourceId: number | null; actorOidcSubject: string | null }>;
  }>(response, 200);
  return body.items.filter(
    (item) => item.action === 'payment.proof_viewed' && item.resourceId === paymentId,
  );
}

async function reviewPayment(
  page: Page,
  context: BrowserContext,
  sellerContext: BrowserContext,
  moderatorContext: BrowserContext | null,
  payment: Payment,
  listingTitle: string,
  status: 'confirmed' | 'rejected',
  reason?: string,
) {
  await page.goto('/admin/payments');
  const pageOrigin = new URL(page.url()).origin;
  await page.locator('main select').first().selectOption('en');
  const statusFilter = page.locator('main select').nth(1);
  const pendingQueueResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes('/api/admin/payments?status=pending') &&
      response.request().method() === 'GET',
  );
  await statusFilter.selectOption('pending');
  await expect(statusFilter).toHaveValue('pending');
  const pendingQueue = await expectJson<{
    items: Array<Payment & {
      user: { id: number; name: string | null; email: string | null; phone: string | null };
      listing: { id: number; title: string; status: string; createdAt: string } | null;
      package: { id: number; name: string; price: string; currency: string } | null;
      method: { id: number; name: string } | null;
      proofImageUrl: string | null;
    }>;
  }>(await pendingQueueResponsePromise, 200);
  const queuedPayment = pendingQueue.items.find((item) => item.id === payment.id);
  expect(queuedPayment).toMatchObject({
    status: 'pending',
    listing: { id: payment.listingId, title: listingTitle },
    package: { name: payment.package?.name, price: payment.amount, currency: payment.currency },
    method: { name: payment.method?.name },
    transactionReference: payment.transactionReference,
    proofImageUrl: `/api/admin/payments/${payment.id}/proof`,
  });
  expect(queuedPayment?.proofImageUrl).not.toMatch(/^https?:\/\//);

  const row = page.locator('tr').filter({ hasText: listingTitle });
  await expect(row).toBeVisible();
  await expect(row).toContainText(payment.package?.name || '');
  await expect(row.locator('td').nth(3)).toContainText(
    `${new Intl.NumberFormat('fr-MR-u-nu-latn', {
      maximumFractionDigits: 2,
    }).format(Number(payment.amount))} ${payment.currency}`,
  );
  await expect(row.locator('td').nth(4)).toContainText(payment.method?.name || '');
  await expect(row.locator('td').nth(5)).toContainText(payment.transactionReference);
  await expect(row.getByTestId(`link-payment-proof-${payment.id}`)).toHaveAttribute(
    'href',
    `/api/admin/payments/${payment.id}/proof`,
  );
  const auditsBeforeProofView = await getPaymentProofAudits(context, payment.id);
  expect(auditsBeforeProofView).toHaveLength(0);

  const proofResponse = await context.request.get(`/api/admin/payments/${payment.id}/proof`);
  const proofBody = await proofResponse.body();
  expect(proofResponse.status(), proofBody.toString()).toBe(200);
  expect(proofResponse.headers()['content-type']).toContain('image/png');
  expect(proofResponse.headers()['cache-control']).toBe('private, no-store');
  expect(proofResponse.headers()['x-content-type-options']).toBe('nosniff');
  expect(proofResponse.headers()['content-disposition']).toBe('inline');
  expect(proofBody).toEqual(proofPng);
  const auditsAfterAdminProofView = await getPaymentProofAudits(context, payment.id);
  expect(auditsAfterAdminProofView).toHaveLength(1);
  expect(auditsAfterAdminProofView[0]).toMatchObject({
    action: 'payment.proof_viewed',
    resourceId: payment.id,
  });
  expect(auditsAfterAdminProofView[0].actorOidcSubject).toBeTruthy();

  if (moderatorContext) {
    const moderatorProofResponse = await moderatorContext.request.get(
      `/api/admin/payments/${payment.id}/proof`,
    );
    await expectJson<{ error: string }>(moderatorProofResponse, 404);
  }

  const sellerProofResponse = await sellerContext.request.get(
    `/api/admin/payments/${payment.id}/proof`,
  );
  const sellerProofBody = await expectJson<{ error: string }>(sellerProofResponse, 404);
  expect(sellerProofBody).toEqual({ error: 'Not found' });
  await expect
    .poll(() => getPaymentProofAudits(context, payment.id))
    .toHaveLength(1);

  const unauthenticatedContext = await request.newContext({ baseURL: pageOrigin });
  try {
    const unauthenticatedProofResponse = await unauthenticatedContext.get(
      `/api/admin/payments/${payment.id}/proof`,
    );
    expect(unauthenticatedProofResponse.status()).toBe(404);
    await expect(unauthenticatedProofResponse.json()).resolves.toEqual({ error: 'Not found' });
  } finally {
    await unauthenticatedContext.dispose();
  }

  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/admin/payments/${payment.id}/status`) &&
      response.request().method() === 'PATCH',
  );
  if (status === 'confirmed') {
    await row.getByTestId(`button-confirm-payment-${payment.id}`).click();
  } else {
    await row.getByTestId(`button-reject-payment-${payment.id}`).click();
    await page.locator('textarea').fill(reason!);
  }
  await page.getByRole('dialog').getByRole('button').last().click();
  await expect((await responsePromise).status()).toBe(200);

  const paymentsResponse = await context.request.get('/api/admin/payments');
  const payments = await expectJson<{ items: Payment[] }>(paymentsResponse, 200);
  expect(payments.items.find((item) => item.id === payment.id)?.status).toBe(status);
}

async function publishListing(page: Page, context: BrowserContext, listing: Listing) {
  await page.goto('/admin/payments');
  const row = page.locator('tr').filter({ hasText: listing.title });
  await expect(row).toBeVisible();
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/admin/listings/${listing.id}/status`) &&
      response.request().method() === 'PATCH',
  );
  await row.getByTestId(`button-publish-listing-${listing.id}`).click();
  await page.getByRole('dialog').getByRole('button').last().click();
  await expect((await responsePromise).status()).toBe(200);
  const published = await getListing(context, listing.title);
  expect(published.status).toBe('active');
}

async function seedListingExpiration(listingId: number): Promise<() => Promise<void>> {
  const { pool } = await import('../lib/db/src/index');
  await pool.query(
    'UPDATE marketplace_listings SET expires_at = NOW() - INTERVAL \'1 second\' WHERE id = $1',
    [listingId],
  );
  return () => pool.end();
}

test.describe('payment review flow', () => {
  test('repeated admin requests keep one local administrator', async ({ browser }) => {
    const adminContext = await browser.newContext({ storageState: adminStorageState });
    const adminPage = await adminContext.newPage();
    try {
      await adminPage.goto('/admin');
      const responses = await Promise.all([
        adminContext.request.get('/api/admin/me'),
        adminContext.request.get('/api/admin/me'),
        adminContext.request.get('/api/admin/me'),
      ]);
      const meResponses = await Promise.all(
        responses.map((response) => expectJson<{
          role: string;
          user: { id: number; role: string } | null;
        }>(response, 200)),
      );
      expect(meResponses.map((response) => response.user?.id)).toEqual([
        meResponses[0].user?.id,
        meResponses[0].user?.id,
        meResponses[0].user?.id,
      ]);
      expect(meResponses[0]).toMatchObject({
        role: 'admin',
        user: { role: 'admin' },
      });

      const users = await expectJson<{
        items: Array<{ id: number; role: string; oidcSubject: string | null }>;
      }>(await adminContext.request.get('/api/admin/users'), 200);
      const administrators = users.items.filter(
        (user) => user.role === 'admin',
      );
      expect(administrators).toHaveLength(1);
      expect(administrators[0].id).toBe(meResponses[0].user?.id);
    } finally {
      await adminContext.close();
    }
  });

  test('a changed identity-provider administrator cannot create a second local administrator', async ({ browser }) => {
    const adminContext = await browser.newContext({ storageState: adminStorageState });
    const secondaryAdminContext = await browser.newContext({ storageState: secondaryAdminStorageState });
    const adminPage = await adminContext.newPage();
    const secondaryAdminPage = await secondaryAdminContext.newPage();
    try {
      await adminPage.goto('/admin');
      await secondaryAdminPage.goto('/admin');
      const secondaryMe = await expectJson<{
        error: string;
      }>(await secondaryAdminContext.request.get('/api/admin/me'), 404);
      expect(secondaryMe).toEqual({ error: 'Not found' });
      await expectJson<{ error: string }>(
        await secondaryAdminContext.request.get('/api/admin/overview'),
        404,
      );

      const users = await expectJson<{
        items: Array<{ id: number; role: string }>;
      }>(await adminContext.request.get('/api/admin/users'), 200);
      expect(users.items.filter((user) => user.role === 'admin')).toHaveLength(1);
    } finally {
      await secondaryAdminContext.close();
      await adminContext.close();
    }
  });

  test('ordinary users cannot mutate the catalog or use administrator-only actions', async ({ browser }) => {
    const sellerContext = await browser.newContext({ storageState: sellerStorageState });

    try {
      const categoryResponse = await sellerContext.request.post('/api/admin/categories', {
        data: {
          name: 'Unauthorized category',
          nameFr: 'Catégorie non autorisée',
          nameEn: 'Unauthorized category',
          slug: `unauthorized-${Date.now()}`,
          icon: 'wheat',
        },
      });
      const categoryBody = await expectJson<{ error: string }>(categoryResponse, 404);
      expect(categoryBody).toEqual({ error: 'Not found' });

      const listingActionResponse = await sellerContext.request.patch(
        '/api/admin/listings/1/status',
        { data: { status: 'active' } },
      );
      const listingActionBody = await expectJson<{ error: string }>(listingActionResponse, 404);
      expect(listingActionBody).toEqual({ error: 'Not found' });

      const packageActionResponse = await sellerContext.request.post('/api/admin/packages', {
        data: {},
      });
      const packageActionBody = await expectJson<{ error: string }>(packageActionResponse, 404);
      expect(packageActionBody).toEqual({ error: 'Not found' });
    } finally {
      await sellerContext.close();
    }
  });

  test('rejects cross-site state changes while allowing same-origin state changes', async ({ browser }) => {
    const sellerContext = await browser.newContext({ storageState: sellerStorageState });
    const sellerPage = await sellerContext.newPage();

    try {
      await sellerPage.goto('/');
      const pageOrigin = new URL(sellerPage.url()).origin;
      const supportData = {
        message: `E2E CSRF boundary ${Date.now()}`,
        requestContact: false,
      };

      const crossSiteResponse = await sellerContext.request.post('/api/support', {
        headers: { origin: 'https://attacker.example' },
        data: supportData,
      });
      const crossSiteBody = await expectJson<{ error: string }>(crossSiteResponse, 403);
      expect(crossSiteBody).toEqual({ error: 'Cross-site request blocked' });

      const sameOriginResponse = await sellerContext.request.post('/api/support', {
        headers: { origin: pageOrigin },
        data: supportData,
      });
      const sameOriginBody = await expectJson<{ id: number; createdAt: string }>(
        sameOriginResponse,
        201,
      );
      expect(sameOriginBody.id).toBeGreaterThan(0);
      expect(sameOriginBody.createdAt).toBeTruthy();
    } finally {
      await sellerContext.close();
    }
  });

  test('ordinary seller can submit a listing for review without payment while paid listings are disabled', async ({ browser }) => {
    test.skip(paidListingsEnabled, 'This regression verifies the temporarily disabled paid-listing mode.');
    test.skip(!adminInitialPassword, 'Set ADMIN_INITIAL_PASSWORD to verify the administrator review step.');
    const sellerContext = await browser.newContext({ storageState: sellerStorageState });
    const secondSellerContext = await browser.newContext({ storageState: secondSellerStorageState });
    const adminContext = await browser.newContext({ storageState: adminStorageState });
    const sellerPage = await sellerContext.newPage();
    const adminPage = await adminContext.newPage();
    const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const title = `E2E no-payment listing ${runId}`;
    const rejectedTitle = `E2E rejected listing ${runId}`;
    const rejectionReason = `Please update the supporting details for ${runId}.`;
    const listingIds: number[] = [];

    try {
      const passwordLogin = await adminContext.request.post('/api/admin/password/login', {
        data: { password: adminInitialPassword },
      });
      expect(passwordLogin.status(), await passwordLogin.text()).toBe(200);

      const listing = await createListing(sellerPage, title);
      listingIds.push(listing.id);
      const rejectedListing = await createListing(sellerPage, rejectedTitle);
      listingIds.push(rejectedListing.id);
      const sellerNotificationsBefore = await expectJson<{ items: Notification[]; unreadCount: number }>(
        await sellerContext.request.get('/api/notifications'),
        200,
      );
      const pendingListing = await getListing(adminContext, title);
      expect(pendingListing.status).toBe('pending_review');
      await expect(sellerPage.getByTestId('link-nav-myPayments')).toHaveCount(0);
      await sellerPage.goto('/payments');
      await expect(sellerPage).toHaveURL(/\/$/);
      await expect(sellerPage.getByTestId('payment-confirmation-panel')).toHaveCount(0);

      const paymentOptions = await expectJson<{ packages: unknown[]; methods: unknown[] }>(
        await sellerContext.request.get('/api/payment-options'),
        200,
      );
      expect(paymentOptions).toEqual({ packages: [], methods: [] });
      await expectJson<{ error: string }>(
        await sellerContext.request.post('/api/payments', { data: {} }),
        410,
      );
      await expectJson<{ error: string }>(
        await sellerContext.request.post('/api/payment-proof/uploads/request-url', { data: {} }),
        410,
      );

      await adminPage.goto('/admin/listings?status=pending_review');
      await adminPage.locator('main input[type="text"]').fill(title);
      const pendingReviewRow = adminPage.locator('tbody tr').filter({ hasText: title });
      await expect(pendingReviewRow).toBeVisible();
      const approvalResponsePromise = adminPage.waitForResponse(
        (response) =>
          response.url().includes(`/api/admin/listings/${listing.id}/status`) &&
          response.request().method() === 'PATCH',
      );
      await pendingReviewRow.getByTestId(`button-publish-listing-${listing.id}`).click();
      await adminPage.getByRole('dialog').getByRole('button').last().click();
      await expectJson(await approvalResponsePromise, 200);
      await expectJson(
        await adminContext.request.patch(`/api/admin/listings/${listing.id}/status`, {
          data: { status: 'active' },
        }),
        200,
      );
      const approvedListing = await getListing(adminContext, title);
      expect(approvedListing.status).toBe('active');
      await expectJson(await sellerContext.request.get(`/api/listings/${listing.id}`), 200);
      await expectJson(
        await adminContext.request.patch(`/api/admin/listings/${rejectedListing.id}/status`, {
          data: { status: 'rejected', reason: rejectionReason },
        }),
        200,
      );
      await expectJson(
        await adminContext.request.patch(`/api/admin/listings/${rejectedListing.id}/status`, {
          data: { status: 'rejected', reason: rejectionReason },
        }),
        200,
      );

      const sellerNotifications = await expectJson<{ items: Notification[]; unreadCount: number }>(
        await sellerContext.request.get('/api/notifications'),
        200,
      );
      const approvalNotification = sellerNotifications.items.find(
        (item) => item.listingId === listing.id && item.type === 'listing_approved',
      );
      const rejectionNotification = sellerNotifications.items.find(
        (item) => item.listingId === rejectedListing.id && item.type === 'listing_rejected',
      );
      expect(approvalNotification).toMatchObject({
        listingId: listing.id,
        read: false,
        title: 'تم قبول إعلانك بنجاح.',
        body: `اسم الإعلان: «${title}»`,
      });
      expect(rejectionNotification).toMatchObject({
        listingId: rejectedListing.id,
        read: false,
        title: 'تم رفض إعلانك.',
        body: `اسم الإعلان: «${rejectedTitle}»\nسبب الرفض: ${rejectionReason}`,
      });
      expect(sellerNotifications.items.filter(
        (item) => item.listingId === listing.id && item.type === 'listing_approved',
      )).toHaveLength(1);
      expect(sellerNotifications.items.filter(
        (item) => item.listingId === rejectedListing.id && item.type === 'listing_rejected',
      )).toHaveLength(1);
      expect(sellerNotifications.unreadCount).toBeGreaterThanOrEqual(
        sellerNotificationsBefore.unreadCount + 2,
      );

      const secondSellerNotifications = await expectJson<{ items: Notification[] }>(
        await secondSellerContext.request.get('/api/notifications'),
        200,
      );
      expect(secondSellerNotifications.items.some(
        (item) => item.listingId === listing.id || item.listingId === rejectedListing.id,
      )).toBe(false);
      await expectJson(
        await secondSellerContext.request.patch(`/api/notifications/${approvalNotification!.id}/read`),
        404,
      );

      await sellerPage.setViewportSize({ width: 390, height: 844 });
      await sellerContext.addInitScript("localStorage.setItem('marketplace-language', 'ar')");
      await sellerPage.goto('/notifications');
      const sidebarNotifications = sellerPage.getByTestId('link-nav-notifications');
      const unreadBadge = sidebarNotifications.locator('span.ms-auto');
      await expect(unreadBadge).toBeVisible();
      await expect(unreadBadge).not.toBeEmpty();
      await expect(sidebarNotifications).toBeVisible();
      await sellerPage.goto('/notifications');

      const approvalCard = sellerPage.locator(`a[href="/listings/${listing.id}"]`);
      const rejectionCard = sellerPage.locator(`a[href="/listings/${rejectedListing.id}"]`);
      await expect(approvalCard).toBeVisible();
      await expect(rejectionCard).toBeVisible();
      await expect(sellerPage.getByTestId(`notification-status-icon-${approvalNotification!.id}`))
        .toHaveClass(/text-emerald-700/);
      await expect(sellerPage.getByTestId(`notification-status-icon-${rejectionNotification!.id}`))
        .toHaveClass(/text-rose-700/);
      const expectedFrenchDate = new Intl.DateTimeFormat('fr-FR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }).format(new Date(approvalNotification!.createdAt));
      await expect(approvalCard.locator('time')).toHaveText(expectedFrenchDate);

      const approvalReadResponsePromise = sellerPage.waitForResponse(
        (response) =>
          response.url().includes(`/api/notifications/${approvalNotification!.id}/read`) &&
          response.request().method() === 'PATCH',
      );
      await approvalCard.click();
      await expect(sellerPage).toHaveURL(new RegExp(`/listings/${listing.id}(?:[/?#]|$)`));
      await expect(sellerPage.getByRole('heading', { name: title, exact: true })).toBeVisible();
      expect(await expectJson<Notification>(await approvalReadResponsePromise, 200)).toMatchObject({
        id: approvalNotification!.id,
        read: true,
      });

      await sellerPage.goto('/notifications');
      const rejectionReadResponsePromise = sellerPage.waitForResponse(
        (response) =>
          response.url().includes(`/api/notifications/${rejectionNotification!.id}/read`) &&
          response.request().method() === 'PATCH',
      );
      await sellerPage.locator(`a[href="/listings/${rejectedListing.id}"]`).click();
      await expect(sellerPage).toHaveURL(new RegExp(`/listings/${rejectedListing.id}(?:[/?#]|$)`));
      await expect(sellerPage.getByRole('heading', { name: rejectedTitle, exact: true })).toBeVisible();
      expect(await expectJson<Notification>(await rejectionReadResponsePromise, 200)).toMatchObject({
        id: rejectionNotification!.id,
        read: true,
      });
      await expectJson(
        await secondSellerContext.request.get(`/api/listings/${rejectedListing.id}`),
        404,
      );

      await sellerPage.goto('/terms');
      await expect(
        sellerPage.getByRole('heading', { name: /payment and review|paiement et validation|الدفع والمراجعة/i }),
      ).toHaveCount(0);
    } finally {
      for (const listingId of listingIds) {
        await adminContext.request.patch(`/api/admin/listings/${listingId}/status`, {
          data: { status: 'suspended' },
        }).catch(() => undefined);
      }
      await sellerContext.close();
      await secondSellerContext.close();
      await adminContext.close();
    }
  });

  test('signed-in sellers can open notifications from the sidebar', async ({ browser }) => {
    const sellerContext = await browser.newContext({ storageState: sellerStorageState });
    const sellerPage = await sellerContext.newPage();

    try {
      await sellerPage.setViewportSize({ width: 390, height: 844 });
      const notificationsResponsePromise = sellerPage.waitForResponse(
        (response) =>
          response.url().includes('/api/notifications') &&
          response.request().method() === 'GET',
      );
      await sellerPage.goto('/');
      const notificationsResponse = await notificationsResponsePromise;
      expect(notificationsResponse.status()).toBe(200);
      const notificationData = await notificationsResponse.json() as {
        items: Notification[];
        unreadCount: number;
      };

      await sellerPage.getByTestId('button-open-menu').click();
      const sidebarNotifications = sellerPage.getByTestId('link-nav-notifications');
      await expect(sidebarNotifications).toBeVisible();
      const unreadBadge = sidebarNotifications.locator('span.ms-auto');
      if (notificationData.unreadCount > 0) {
        await expect(unreadBadge).toBeVisible();
        await expect(unreadBadge).not.toBeEmpty();
      } else {
        await expect(unreadBadge).toHaveCount(0);
      }

      await sidebarNotifications.click();
      await expect(sellerPage).toHaveURL(/\/notifications(?:[/?#]|$)/);
      await expect(sellerPage.getByRole('heading', { name: /notifications|الإشعارات/i })).toBeVisible();
      if (notificationData.items.length > 0) {
        await expect(sellerPage.getByText(notificationData.items[0].body, { exact: true })).toBeVisible();
      }
    } finally {
      await sellerContext.close();
    }
  });

  test('seller can submit payment and admin review updates listings and notifications', async ({ browser }) => {
    test.skip(!paidListingsEnabled, 'Paid listings are temporarily disabled.');
  const sellerContext = await browser.newContext({ storageState: sellerStorageState });
  const secondSellerContext = await browser.newContext({ storageState: secondSellerStorageState });
  const adminContext = await browser.newContext({ storageState: adminStorageState });
  const moderatorContext = await browser.newContext({ storageState: moderatorStorageState });
  const sellerPage = await sellerContext.newPage();
  const adminPage = await adminContext.newPage();
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const confirmedTitle = `E2E confirmed listing ${runId}`;
  const rejectedTitle = `E2E rejected listing ${runId}`;
  const rejectionReason = 'Payment proof does not match the transaction reference.';

  try {
    await adminPage.goto('/admin/notifications');
    const confirmedListing = await createListing(sellerPage, confirmedTitle);
    const adminNotifications = adminPage.locator('button').filter({ hasText: confirmedTitle });
    await expect(adminNotifications).toBeVisible({ timeout: 15_000 });
    const adminNotificationResponse = await adminContext.request.get('/api/admin/notifications');
    const adminNotificationBody = await expectJson<{
      items: Array<{ listingId: number; read: boolean; sellerName: string | null; listingTitle: string | null; paymentStatus: string }>;
      unreadCount: number;
    }>(adminNotificationResponse, 200);
    const newAdminNotification = adminNotificationBody.items.find(
      (item) => item.listingId === confirmedListing.id,
    );
    expect(newAdminNotification).toMatchObject({
      listingId: confirmedListing.id,
      read: false,
      listingTitle: confirmedTitle,
      paymentStatus: 'pending',
    });
    expect(adminNotificationBody.unreadCount).toBeGreaterThan(0);
    await adminNotifications.click();
    await expect(adminPage).toHaveURL(/\/admin\/listings\?status=pending_payment$/);
    const readAdminNotificationResponse = await adminContext.request.get('/api/admin/notifications');
    const readAdminNotificationBody = await expectJson<{
      items: Array<{ listingId: number; read: boolean }>;
    }>(readAdminNotificationResponse, 200);
    expect(readAdminNotificationBody.items.find((item) => item.listingId === confirmedListing.id)?.read).toBe(true);

    const confirmedPayment = await submitPayment(sellerPage, confirmedListing, `E2E-CONFIRM-${runId}`);
    const pendingNotifications = await expectJson<{ items: Notification[] }>(
      await sellerContext.request.get('/api/notifications'),
      200,
    );
    expect(pendingNotifications.items.some((item) => item.type === 'payment_pending')).toBe(true);

    await expectJson(await sellerContext.request.get(`/api/listings/${confirmedListing.id}`), 404);
    const activationAttempt = await adminContext.request.patch(`/api/admin/listings/${confirmedListing.id}/status`, {
      data: { status: 'active' },
    });
    await expectJson<{ error: string }>(activationAttempt, 409);

    await reviewPayment(
      adminPage,
      adminContext,
      secondSellerContext,
      moderatorContext,
      confirmedPayment,
      confirmedTitle,
      'confirmed',
    );
    const confirmedAdminListing = await getListing(adminContext, confirmedTitle);
    expect(confirmedAdminListing.status).toBe('pending_payment');
    await expectJson(await sellerContext.request.get(`/api/listings/${confirmedListing.id}`), 404);
    await publishListing(adminPage, adminContext, confirmedListing);
    await expectJson<{ items: Listing[] }>(
      await sellerContext.request.get(`/api/listings/${confirmedListing.id}`),
      200,
    );

    const rejectedListing = await createListing(sellerPage, rejectedTitle);
    const rejectedPayment = await submitPayment(sellerPage, rejectedListing, `E2E-REJECT-${runId}`);
    await reviewPayment(
      adminPage,
      adminContext,
      secondSellerContext,
      moderatorContext,
      rejectedPayment,
      rejectedTitle,
      'rejected',
      rejectionReason,
    );

    const notifications = await expectJson<{ items: Notification[] }>(
      await sellerContext.request.get('/api/notifications'),
      200,
    );
    expect(notifications.items.filter((item) => item.type === 'payment_status').length).toBeGreaterThanOrEqual(2);
    expect(notifications.items.some((item) => item.body === rejectionReason)).toBe(true);
    const rejectedAdminListing = await getListing(adminContext, rejectedTitle);
    expect(rejectedAdminListing.status).toBe('rejected');
    await expectJson(await sellerContext.request.get(`/api/listings/${rejectedListing.id}`), 200);
    await expectJson(await secondSellerContext.request.get(`/api/listings/${rejectedListing.id}`), 404);

    const auditLogs = await expectJson<{ items: Array<{ action: string; resourceId: number }> }>(
      await adminContext.request.get('/api/admin/audit-logs'),
      200,
    );
    expect(auditLogs.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: 'payment.confirmed', resourceId: confirmedPayment.id }),
        expect.objectContaining({ action: 'payment.rejected', resourceId: rejectedPayment.id }),
      ]),
    );

    await sellerPage.goto('/notifications');
    await expect(sellerPage.locator('body')).toContainText(rejectionReason);
  } finally {
    await sellerContext.close();
    await secondSellerContext.close();
    await adminContext.close();
    await moderatorContext.close();
  }
  });

  test('concurrent payment submissions create one pending payment and one conflict', async ({ browser }) => {
    test.skip(!paidListingsEnabled, 'Paid listings are temporarily disabled.');
    const sellerContext = await browser.newContext({ storageState: sellerStorageState });
    const sellerPage = await sellerContext.newPage();
    const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    try {
      const listing = await createListing(sellerPage, `E2E concurrent payment ${runId}`);
      const [firstProof, secondProof] = await Promise.all([
        uploadPaymentProof(sellerContext),
        uploadPaymentProof(sellerContext),
      ]);

      const [firstResponse, secondResponse] = await Promise.all([
        submitPaymentWithProof(
          sellerContext,
          listing,
          firstProof,
          `E2E-RACE-FIRST-${runId}`,
        ),
        submitPaymentWithProof(
          sellerContext,
          listing,
          secondProof,
          `E2E-RACE-SECOND-${runId}`,
        ),
      ]);

      const responseStatuses = [firstResponse.status(), secondResponse.status()].sort();
      expect(responseStatuses).toEqual([201, 409]);
      const conflictResponse = firstResponse.status() === 409 ? firstResponse : secondResponse;
      const conflictBody = await expectJson<{ error: string }>(conflictResponse, 409);
      expect(conflictBody).toEqual({
        error: 'A payment confirmation is already pending',
      });

      const payments = await expectJson<{ items: Payment[] }>(
        await sellerContext.request.get('/api/payments/mine'),
        200,
      );
      const listingPayments = payments.items.filter(
        (payment) => payment.listingId === listing.id && payment.status === 'pending',
      );
      expect(listingPayments).toHaveLength(1);
      expect([
        `E2E-RACE-FIRST-${runId}`,
        `E2E-RACE-SECOND-${runId}`,
      ]).toContain(listingPayments[0].transactionReference);
    } finally {
      await sellerContext.close();
    }
  });

  test('concurrent administrator reviews produce one outcome and one notification', async ({ browser }) => {
    test.skip(!paidListingsEnabled, 'Paid listings are temporarily disabled.');
    const sellerContext = await browser.newContext({ storageState: sellerStorageState });
    const adminContext = await browser.newContext({ storageState: adminStorageState });
    const moderatorContext = await browser.newContext({ storageState: moderatorStorageState });
    const sellerPage = await sellerContext.newPage();
    const adminPage = await adminContext.newPage();
    const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const rejectionReason = `Concurrent payment review conflict ${runId}`;

    try {
      const adminPassword = process.env.ADMIN_INITIAL_PASSWORD;
      if (!adminPassword) throw new Error('ADMIN_INITIAL_PASSWORD is required for administrator review E2E tests');
      const adminMeResponsePromise = adminPage.waitForResponse(
        (response) =>
          response.url().includes('/api/admin/me') &&
          response.request().method() === 'GET',
      );
      await adminPage.goto('/admin/login');
      await adminMeResponsePromise;
      const adminPasswordResponse = await adminContext.request.post('/api/admin/password/login', {
        data: { password: adminPassword },
      });
      expect(adminPasswordResponse.status(), await adminPasswordResponse.text()).toBe(200);
      await expectJson<{ error: string }>(
        await moderatorContext.request.get('/api/admin/me'),
        404,
      );

      const listing = await createListing(sellerPage, `E2E concurrent review ${runId}`);
      const payment = await submitPayment(sellerPage, listing, `E2E-REVIEW-RACE-${runId}`);
      const notificationsBefore = await expectJson<{ items: Notification[] }>(
        await sellerContext.request.get('/api/notifications'),
        200,
      );
      const auditsBefore = await expectJson<{
        items: Array<{ action: string; resourceId: number | null }>;
      }>(await adminContext.request.get('/api/admin/audit-logs'), 200);

      const [confirmedResponse, rejectedResponse, moderatorResponse] = await Promise.all([
        adminContext.request.patch(`/api/admin/payments/${payment.id}/status`, {
          data: { status: 'confirmed' },
        }),
        adminContext.request.patch(`/api/admin/payments/${payment.id}/status`, {
          data: { status: 'rejected', reason: rejectionReason },
        }),
        moderatorContext.request.patch(`/api/admin/payments/${payment.id}/status`, {
          data: { status: 'rejected', reason: rejectionReason },
        }),
      ]);
      expect([confirmedResponse.status(), rejectedResponse.status()].sort()).toEqual([200, 409]);
      await expectJson<{ error: string }>(moderatorResponse, 404);

      const successfulResponse = confirmedResponse.status() === 200
        ? confirmedResponse
        : rejectedResponse;
      const conflictResponse = confirmedResponse.status() === 409
        ? confirmedResponse
        : rejectedResponse;
      const finalPayment = await expectJson<Payment>(successfulResponse, 200);
      const conflictBody = await expectJson<{ error: string }>(conflictResponse, 409);
      expect(conflictBody).toEqual({ error: 'Payment has already been reviewed' });
      expect(['confirmed', 'rejected']).toContain(finalPayment.status);

      const payments = await expectJson<{ items: Payment[] }>(
        await sellerContext.request.get('/api/payments/mine'),
        200,
      );
      const reviewedPayments = payments.items.filter((item) => item.id === payment.id);
      expect(reviewedPayments).toHaveLength(1);
      expect(reviewedPayments[0].status).toBe(finalPayment.status);

      const notificationsAfter = await expectJson<{ items: Notification[] }>(
        await sellerContext.request.get('/api/notifications'),
        200,
      );
      const paymentNotificationsBefore = notificationsBefore.items.filter(
        (item) => item.type === 'payment_status' &&
          (item.body === rejectionReason || item.body === `تم تحديث طلب الدفع رقم ${payment.id}.`),
      );
      const paymentNotificationsAfter = notificationsAfter.items.filter(
        (item) => item.type === 'payment_status' &&
          (item.body === rejectionReason || item.body === `تم تحديث طلب الدفع رقم ${payment.id}.`),
      );
      expect(paymentNotificationsAfter.length - paymentNotificationsBefore.length).toBe(1);
      expect(paymentNotificationsAfter.at(-1)?.body).toBe(
        finalPayment.status === 'rejected'
          ? rejectionReason
          : `تم تحديث طلب الدفع رقم ${payment.id}.`,
      );

      const auditsAfter = await expectJson<{
        items: Array<{ action: string; resourceId: number | null }>;
      }>(await adminContext.request.get('/api/admin/audit-logs'), 200);
      const paymentAuditsBefore = auditsBefore.items.filter(
        (item) => item.resourceId === payment.id && item.action.startsWith('payment.'),
      );
      const paymentAuditsAfter = auditsAfter.items.filter(
        (item) => item.resourceId === payment.id && item.action.startsWith('payment.'),
      );
      expect(paymentAuditsAfter.length - paymentAuditsBefore.length).toBe(1);
      expect(paymentAuditsAfter.at(-1)?.action).toBe(`payment.${finalPayment.status}`);
    } finally {
      await sellerContext.close();
      await adminContext.close();
      await moderatorContext.close();
    }
  });

  test('rejects invalid payment proof metadata before issuing an upload URL', async ({ browser }) => {
    test.skip(!paidListingsEnabled, 'Paid listings are temporarily disabled.');
    const sellerContext = await browser.newContext({ storageState: sellerStorageState });
    try {
      const invalidProofs = [
        { name: 'receipt.gif', size: proofPng.length, contentType: 'image/gif' },
        { name: '   ', size: proofPng.length, contentType: 'image/png' },
        { name: 'receipt.png', size: 1_800_001, contentType: 'image/png' },
      ];

      for (const proof of invalidProofs) {
        const response = await sellerContext.request.post(
          '/api/payment-proof/uploads/request-url',
          { data: proof },
        );
        const body = await expectJson<{ error: string }>(response, 400);
        expect(body).toEqual({ error: 'Invalid payment proof file' });
        expect(body).not.toHaveProperty('uploadURL');
        expect(body).not.toHaveProperty('objectPath');
      }
    } finally {
      await sellerContext.close();
    }
  });

  test('shows the localized validation message for an unsupported payment proof file', async ({ browser }) => {
    test.skip(!paidListingsEnabled, 'Paid listings are temporarily disabled.');
    const sellerContext = await browser.newContext({ storageState: sellerStorageState });
    const sellerPage = await sellerContext.newPage();
    const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    let requestUrlCount = 0;
    const recordRequestUrl = (request: Request) => {
      if (
        request.method() === 'POST' &&
        request.url().includes('/api/payment-proof/uploads/request-url')
      ) {
        requestUrlCount += 1;
      }
    };

    try {
      const listing = await createListing(sellerPage, `E2E invalid proof ${runId}`);
      await selectMarketplaceLanguage(sellerPage, 'en');
      sellerPage.on('request', recordRequestUrl);

      await sellerPage.getByTestId('input-payment-proof').setInputFiles({
        name: 'receipt.gif',
        mimeType: 'image/gif',
        buffer: proofPng,
      });

      await expect(sellerPage.getByRole('alert')).toHaveText(
        'Choose a PNG, JPG, or WebP image smaller than 1.8 MB.',
      );
      expect(requestUrlCount).toBe(0);
      expect(listing.id).toBeGreaterThan(0);
    } finally {
      sellerPage.off('request', recordRequestUrl);
      await sellerContext.close();
    }
  });

  test('a seller cannot submit another seller payment proof', async ({ browser }) => {
    test.skip(!paidListingsEnabled, 'Paid listings are temporarily disabled.');
    const sellerContext = await browser.newContext({ storageState: sellerStorageState });
    const secondSellerContext = await browser.newContext({
      storageState: secondSellerStorageState,
    });
    const sellerPage = await sellerContext.newPage();
    const secondSellerPage = await secondSellerContext.newPage();
    const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    try {
      const sellerListing = await createListing(
        sellerPage,
        `E2E proof owner ${runId}`,
      );
      const secondSellerListing = await createListing(
        secondSellerPage,
        `E2E proof reuser ${runId}`,
      );
      const proofObjectPath = await uploadPaymentProof(sellerContext);

      const rejectedResponse = await submitPaymentWithProof(
        secondSellerContext,
        secondSellerListing,
        proofObjectPath,
        `E2E-PROOF-REJECT-${runId}`,
      );
      const rejectedBody = await expectJson<{ error: string }>(rejectedResponse, 403);
      expect(rejectedBody.error).toBe(
        'Payment proof upload does not belong to this user',
      );

      const acceptedResponse = await submitPaymentWithProof(
        sellerContext,
        sellerListing,
        proofObjectPath,
        `E2E-PROOF-OWNER-${runId}`,
      );
      const acceptedPayment = await expectJson<Payment>(acceptedResponse, 201);
      expect(acceptedPayment.listingId).toBe(sellerListing.id);
      expect(acceptedPayment.status).toBe('pending');
    } finally {
      await sellerContext.close();
      await secondSellerContext.close();
    }
  });

  test('featured listings follow the payment, moderation, removal, and expiry lifecycle', async ({ browser }) => {
    test.skip(!paidListingsEnabled, 'Paid listings are temporarily disabled.');
    const sellerContext = await browser.newContext({ storageState: sellerStorageState });
    const adminContext = await browser.newContext({ storageState: adminStorageState });
    const sellerPage = await sellerContext.newPage();
    const adminPage = await adminContext.newPage();
    const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const listingTitle = `E2E featured listing ${runId}`;
    let closeDatabase: (() => Promise<void>) | undefined;

    try {
      const listing = await createListing(sellerPage, listingTitle);
      const payment = await submitPayment(sellerPage, listing, `E2E-FEATURED-${runId}`);

      await expectJson(await sellerContext.request.get(`/api/listings/${listing.id}`), 404);
      await expectFeaturedListingOnHome(sellerPage, listingTitle, 'ar', false);

      await reviewPayment(
        adminPage,
        adminContext,
        sellerContext,
        null,
        payment,
        listingTitle,
        'confirmed',
      );
      const pendingPaymentListing = await getListing(adminContext, listingTitle);
      expect(pendingPaymentListing.status).toBe('pending_payment');
      expect(pendingPaymentListing.featured).toBe(false);
      await expectJson(await sellerContext.request.get(`/api/listings/${listing.id}`), 404);

      await publishListing(adminPage, adminContext, listing);
      const published = await expectJson<Listing>(
        await sellerContext.request.get(`/api/listings/${listing.id}`),
        200,
      );
      expect(published.featured).toBe(true);
      expect(published.expiresAt).toBeTruthy();

      for (const language of ['ar', 'fr', 'en'] as const) {
        await expectFeaturedListingOnHome(sellerPage, listingTitle, language, true);
      }

      await adminPage.goto('/admin/listings');
      await adminPage.locator('main select').first().selectOption('en');
      await adminPage.locator('main input[type="text"]').fill(listingTitle);
      const listingRow = adminPage.locator('tbody tr').filter({ hasText: listingTitle });
      await expect(listingRow).toBeVisible();

      const unfeatureResponsePromise = adminPage.waitForResponse(
        (response) =>
          response.url().includes(`/api/admin/listings/${listing.id}/featured`) &&
          response.request().method() === 'PATCH',
      );
      await listingRow.getByTestId(`button-featured-listing-${listing.id}`).click();
      await adminPage.getByRole('dialog').getByRole('button').last().click();
      expect((await unfeatureResponsePromise).status()).toBe(200);

      await expect.poll(async () => (await getListing(adminContext, listingTitle)).featured).toBe(false);
      await expectFeaturedListingOnHome(sellerPage, listingTitle, 'en', false);

      const refeatureResponsePromise = adminPage.waitForResponse(
        (response) =>
          response.url().includes(`/api/admin/listings/${listing.id}/featured`) &&
          response.request().method() === 'PATCH',
      );
      await listingRow.getByTestId(`button-featured-listing-${listing.id}`).click();
      await adminPage.getByRole('dialog').getByRole('button').last().click();
      expect((await refeatureResponsePromise).status()).toBe(200);
      await expect.poll(async () => (await getListing(adminContext, listingTitle)).featured).toBe(true);
      await expectFeaturedListingOnHome(sellerPage, listingTitle, 'en', true);

      closeDatabase = await seedListingExpiration(listing.id);
      await expectFeaturedListingOnHome(sellerPage, listingTitle, 'en', false);
      await expect.poll(
        async () => (await getListing(adminContext, listingTitle)).status,
        { timeout: 75_000, intervals: [1_000, 5_000] },
      ).toBe('expired');
      await expectFeaturedListingOnHome(sellerPage, listingTitle, 'en', false);
    } finally {
      if (closeDatabase) await closeDatabase();
      await sellerContext.close();
      await adminContext.close();
    }
  });

  test('listing contact phone survives title and price edits', async ({ browser }) => {
    test.skip(!paidListingsEnabled, 'Paid listings are temporarily disabled.');
    const sellerContext = await browser.newContext({ storageState: sellerStorageState });
    const adminContext = await browser.newContext({ storageState: adminStorageState });
    const sellerPage = await sellerContext.newPage();
    const adminPage = await adminContext.newPage();
    const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const listingTitle = `E2E contact phone listing ${runId}`;
    const editedTitle = `${listingTitle} updated`;
    const contactPhone = '+222 45 67 89 01';
    const changedContactPhone = '+222 22 33 44 55';

    try {
      const listing = await createListing(sellerPage, listingTitle, contactPhone);
      const payment = await submitPayment(sellerPage, listing, `E2E-CONTACT-${runId}`);
      await reviewPayment(
        adminPage,
        adminContext,
        sellerContext,
        null,
        payment,
        listingTitle,
        'confirmed',
      );
      await publishListing(adminPage, adminContext, listing);

      const published = await expectJson<Listing>(
        await sellerContext.request.get(`/api/listings/${listing.id}`),
        200,
      );
      expect(published.contactPhone).toBe(contactPhone);

      await sellerPage.goto(`/listings/${listing.id}`);
      await expect(sellerPage.getByTestId('link-call-seller')).toHaveAttribute(
        'href',
        `tel:${contactPhone}`,
      );
      await expect(sellerPage.getByTestId('link-call-seller')).toContainText(contactPhone);

      await sellerPage.goto('/dashboard');
      await sellerPage.getByTestId(`button-edit-listing-${listing.id}`).click();
      await expect(sellerPage.getByTestId('input-edit-contact-phone')).toHaveValue(contactPhone);
      await sellerPage.getByTestId('input-edit-title').fill(editedTitle);
      const titleRequestPromise = sellerPage.waitForRequest(
        (request) =>
          request.url().includes(`/api/listings/${listing.id}`) &&
          request.method() === 'PATCH',
      );
      const titleResponsePromise = sellerPage.waitForResponse(
        (response) =>
          response.url().includes(`/api/listings/${listing.id}`) &&
          response.request().method() === 'PATCH',
      );
      await sellerPage.getByTestId('button-save-edit').click();
      const titleRequest = await titleRequestPromise;
      expect(titleRequest.postDataJSON()).not.toHaveProperty('contactPhone');
      const titleUpdate = await expectJson<Listing>(await titleResponsePromise, 200);
      expect(titleUpdate.contactPhone).toBe(contactPhone);

      await publishListing(adminPage, adminContext, { ...listing, title: editedTitle });
      await sellerPage.goto(`/listings/${listing.id}`);
      await expect(sellerPage.getByTestId('link-call-seller')).toHaveAttribute(
        'href',
        `tel:${contactPhone}`,
      );
      await expect(sellerPage.getByTestId('link-call-seller')).toContainText(contactPhone);

      await sellerPage.goto('/dashboard');
      await sellerPage.getByTestId(`button-edit-listing-${listing.id}`).click();
      await expect(sellerPage.getByTestId('input-edit-contact-phone')).toHaveValue(contactPhone);
      await sellerPage.getByTestId('input-edit-price').fill('135000');
      const priceRequestPromise = sellerPage.waitForRequest(
        (request) =>
          request.url().includes(`/api/listings/${listing.id}`) &&
          request.method() === 'PATCH',
      );
      const priceResponsePromise = sellerPage.waitForResponse(
        (response) =>
          response.url().includes(`/api/listings/${listing.id}`) &&
          response.request().method() === 'PATCH',
      );
      await sellerPage.getByTestId('button-save-edit').click();
      const priceRequest = await priceRequestPromise;
      expect(priceRequest.postDataJSON()).not.toHaveProperty('contactPhone');
      const priceUpdate = await expectJson<Listing>(await priceResponsePromise, 200);
      expect(priceUpdate.contactPhone).toBe(contactPhone);

      await publishListing(adminPage, adminContext, { ...listing, title: editedTitle });
      await sellerPage.goto(`/listings/${listing.id}`);
      await expect(sellerPage.getByTestId('link-call-seller')).toHaveAttribute(
        'href',
        `tel:${contactPhone}`,
      );
      await expect(sellerPage.getByTestId('link-call-seller')).toContainText(contactPhone);

      await sellerPage.goto('/dashboard');
      await sellerPage.getByTestId(`button-edit-listing-${listing.id}`).click();
      await sellerPage.getByTestId('input-edit-contact-phone').fill(changedContactPhone);
      const phoneRequestPromise = sellerPage.waitForRequest(
        (request) =>
          request.url().includes(`/api/listings/${listing.id}`) &&
          request.method() === 'PATCH',
      );
      const phoneResponsePromise = sellerPage.waitForResponse(
        (response) =>
          response.url().includes(`/api/listings/${listing.id}`) &&
          response.request().method() === 'PATCH',
      );
      await sellerPage.getByTestId('button-save-edit').click();
      const phoneRequest = await phoneRequestPromise;
      expect(phoneRequest.postDataJSON()).toMatchObject({ contactPhone: changedContactPhone });
      const phoneUpdate = await expectJson<Listing>(await phoneResponsePromise, 200);
      expect(phoneUpdate.contactPhone).toBe(changedContactPhone);

      await publishListing(adminPage, adminContext, { ...listing, title: editedTitle });
      await sellerPage.goto(`/listings/${listing.id}`);
      await expect(sellerPage.getByTestId('link-call-seller')).toHaveAttribute(
        'href',
        `tel:${changedContactPhone}`,
      );
      await expect(sellerPage.getByTestId('link-call-seller')).toContainText(changedContactPhone);
    } finally {
      await sellerContext.close();
      await adminContext.close();
    }
  });

  test('admin removal hides a listing by default but retains it under the suspended filter', async ({ browser }) => {
    const sellerContext = await browser.newContext({ storageState: sellerStorageState });
    const adminContext = await browser.newContext({ storageState: adminStorageState });
    const sellerPage = await sellerContext.newPage();
    const adminPage = await adminContext.newPage();
    const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const listingTitle = `E2E suspended listing ${runId}`;

    try {
      const listing = await createListing(sellerPage, listingTitle);

      await adminPage.goto('/admin/listings');
      await adminPage.locator('main select').first().selectOption('en');
      await adminPage.locator('main input[type="text"]').fill(listingTitle);

      const listingRow = adminPage.locator('tbody tr').filter({ hasText: listingTitle });
      await expect(listingRow).toBeVisible();

      const deleteResponsePromise = adminPage.waitForResponse(
        (response) =>
          response.url().includes(`/api/admin/listings/${listing.id}`) &&
          response.request().method() === 'DELETE',
      );
      await listingRow.locator('button').last().click();
      await adminPage.getByRole('dialog').getByRole('button').last().click();
      await expect((await deleteResponsePromise).status()).toBe(204);

      await expect(listingRow).toHaveCount(0);

      await adminPage.locator('main select').nth(1).selectOption('suspended');
      await expect(listingRow).toBeVisible();
      await expect(listingRow).toContainText('Suspended');
    } finally {
      await sellerContext.close();
      await adminContext.close();
    }
  });

  test('admin text wraps naturally across every page at phone and desktop widths', async ({ browser }) => {
    test.skip(!adminInitialPassword, 'Set ADMIN_INITIAL_PASSWORD to verify authenticated administrator pages.');

    const assertNaturalTextFlow = async (page: Page) => {
      const scope = page.locator('.admin-text-flow').first();
      await expect(scope).toBeVisible();
      const result = await scope.evaluate((root) => {
        const selector = 'h1,h2,h3,h4,h5,h6,p,a,button,label,span,strong,em,small,li,dt,dd,td,th,legend,summary,blockquote,figcaption';
        const styleWindow = root.ownerDocument.defaultView;
        return {
          direction: styleWindow?.getComputedStyle(root).direction,
          wrapValues: Array.from(root.querySelectorAll(selector), (element) =>
            styleWindow?.getComputedStyle(element).overflowWrap,
          ),
          wordBreakValues: Array.from(root.querySelectorAll(selector), (element) =>
            styleWindow?.getComputedStyle(element).wordBreak,
          ),
        };
      });

      expect(['ltr', 'rtl']).toContain(result.direction);
      expect(result.wrapValues.length).toBeGreaterThan(0);
      expect(result.wrapValues).toContain('break-word');
      expect(result.wrapValues).not.toContain('anywhere');
      expect(result.wordBreakValues).not.toContain('break-all');
    };

    const loginContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const loginPage = await loginContext.newPage();
    const adminContext = await browser.newContext({
      storageState: adminStorageState,
      viewport: { width: 390, height: 844 },
    });
    const adminPage = await adminContext.newPage();

    try {
      await loginPage.goto('/admin/login');
      await assertNaturalTextFlow(loginPage);

      const passwordLogin = await adminContext.request.post('/api/admin/password/login', {
        data: { password: adminInitialPassword },
      });
      expect(passwordLogin.status(), await passwordLogin.text()).toBe(200);

      const adminPages = [
        '/admin',
        '/admin/listings',
        '/admin/banners',
        '/admin/notifications',
        '/admin/users',
        '/admin/payments',
        '/admin/packages',
        '/admin/payment-methods',
        '/admin/support-settings',
        '/admin/security',
        '/admin/reports',
        '/admin/audit-logs',
        '/admin/categories',
      ];

      for (const viewport of [
        { width: 390, height: 844 },
        { width: 1440, height: 960 },
      ]) {
        await adminPage.setViewportSize(viewport);
        await adminPage.goto('/admin');
        await assertNaturalTextFlow(adminPage);

        const languageSelect = adminPage.locator('main select').first();
        for (const language of ['ar', 'fr', 'en']) {
          await languageSelect.selectOption(language);
          await expect(languageSelect).toHaveValue(language);
          await assertNaturalTextFlow(adminPage);
        }

        for (const path of adminPages.slice(1)) {
          await adminPage.goto(path);
          await assertNaturalTextFlow(adminPage);
        }
      }

      await adminPage.setViewportSize({ width: 390, height: 844 });
      await adminPage.goto('/admin/listings');
      await expect(adminPage.locator('.admin-text-flow table').first()).toBeVisible();
      const tableWidth = await adminPage.locator('.admin-text-flow table').first().evaluate(
        (table) => table.getBoundingClientRect().width,
      );
      expect(tableWidth).toBeGreaterThanOrEqual(720);

      await adminPage.goto('/admin/packages');
      await adminPage.locator('main select').first().selectOption('en');
      await adminPage.getByRole('button', { name: /new package/i }).click();
      const packageDialog = adminPage.locator('[role="dialog"].admin-text-flow');
      await expect(packageDialog).toBeVisible();
      await expect(packageDialog.locator('h2')).toHaveCSS('overflow-wrap', 'break-word');
      await packageDialog.getByRole('button', { name: /cancel/i }).click();
    } finally {
      await loginContext.close();
      await adminContext.close();
    }
  });
});
