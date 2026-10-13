import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import crypto from 'node:crypto';

const authDir = resolve(process.cwd(), 'e2e/.auth');
const sellerEmail = process.env.E2E_SELLER_EMAIL ?? 'e2e-seller@example.com';
const secondSellerEmail =
  process.env.E2E_SECOND_SELLER_EMAIL ?? 'e2e-second-seller@example.com';
const adminEmail = process.env.E2E_ADMIN_EMAIL ?? 'e2e-admin@example.com';
const moderatorEmail =
  process.env.E2E_MODERATOR_EMAIL ?? 'e2e-moderator@example.com';
const secondaryAdminEmail =
  process.env.E2E_SECONDARY_ADMIN_EMAIL ?? 'e2e-secondary-admin@example.com';
const configuredAdminUserId = process.env.E2E_ADMIN_CLERK_USER_ID;
const sellerStorageState =
  process.env.E2E_SELLER_STORAGE_STATE ?? resolve(authDir, 'seller.json');
const secondSellerStorageState =
  process.env.E2E_SECOND_SELLER_STORAGE_STATE ??
  resolve(authDir, 'second-seller.json');
const adminStorageState =
  process.env.E2E_ADMIN_STORAGE_STATE ?? resolve(authDir, 'admin.json');
const moderatorStorageState =
  process.env.E2E_MODERATOR_STORAGE_STATE ?? resolve(authDir, 'moderator.json');
const secondaryAdminStorageState =
  process.env.E2E_SECONDARY_ADMIN_STORAGE_STATE ?? resolve(authDir, 'admin-secondary.json');

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

async function setupAuth() {
  const baseURL =
    process.env.E2E_BASE_URL ??
    (process.env.REPLIT_DEV_DOMAIN
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : undefined);
  const secretKey =
    process.env.E2E_CLERK_SECRET_KEY ?? process.env.CLERK_SECRET_KEY;

  if (process.env.NODE_ENV === 'production') {
    throw new Error('E2E auth setup is disabled in production.');
  }
  if (!baseURL) {
    throw new Error(
      'E2E_BASE_URL (or REPLIT_DEV_DOMAIN) is required to provision payment-review sessions.',
    );
  }
  const target = new URL(baseURL);
  const isLocalTarget = ['localhost', '127.0.0.1', '[::1]'].includes(
    target.hostname,
  );
  const isReplitPreview = target.hostname.endsWith('.replit.dev');
  if (
    (!isLocalTarget && !isReplitPreview) ||
    target.username ||
    target.password
  ) {
    throw new Error(
      'E2E auth setup only allows localhost or a Replit development preview URL.',
    );
  }
  if (!secretKey) {
    throw new Error(
      'E2E_CLERK_SECRET_KEY (or a test-mode CLERK_SECRET_KEY) is required to provision payment-review sessions.',
    );
  }
  if (!secretKey.startsWith('sk_test_')) {
    throw new Error(
      'E2E auth setup requires a test-mode Clerk secret key; live-mode keys are not allowed.',
    );
  }

  const clerkHeaders = {
    Authorization: `Bearer ${secretKey}`,
    'Content-Type': 'application/json',
  };

  async function clerkRequest(path, init = {}) {
    const response = await fetch(`https://api.clerk.com/v1${path}`, {
      ...init,
      headers: { ...clerkHeaders, ...init.headers },
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(
        `Clerk request ${init.method ?? 'GET'} ${path} failed with ${response.status} ${response.statusText}.`,
      );
    }
    return body;
  }

  async function ensureUser({ email, firstName, lastName, role }) {
    const result = await clerkRequest(
      `/users?email_address=${encodeURIComponent(email)}&limit=10`,
    );
    const users = Array.isArray(result) ? result : result.data ?? [];
    let user = users.find((candidate) =>
      candidate.email_addresses?.some((address) => address.email_address === email),
    );

    if (!user) {
      user = await clerkRequest('/users', {
        method: 'POST',
        body: JSON.stringify({
          email_address: [email],
          first_name: firstName,
          last_name: lastName,
          password: `E2e!${crypto.randomBytes(18).toString('base64url')}a1`,
          public_metadata: role ? { role } : {},
        }),
      });
    } else if (role && user.public_metadata?.role !== role) {
      user = await clerkRequest(`/users/${user.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ public_metadata: { ...(user.public_metadata ?? {}), role } }),
      });
    }

    return user;
  }

  let browser;
  try {
    await mkdir(authDir, { recursive: true });
    await Promise.all(
      [
        sellerStorageState,
        secondSellerStorageState,
        adminStorageState,
        moderatorStorageState,
        secondaryAdminStorageState,
      ].map((filePath) => mkdir(dirname(resolve(filePath)), { recursive: true })),
    );
    browser = await chromium.launch({
      headless: true,
      executablePath: process.env.REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    });

    async function writeStorageState(user, filePath, label) {
      const token = await clerkRequest('/sign_in_tokens', {
        method: 'POST',
        body: JSON.stringify({ user_id: user.id, expires_in_seconds: 600 }),
      });
      if (!token?.token) {
        throw new Error(`Clerk did not return a sign-in ticket for the ${label} user.`);
      }

      const context = await browser.newContext();
      try {
        const page = await context.newPage();
        await page.goto(
          `${baseURL}/sign-in?__clerk_ticket=${encodeURIComponent(token.token)}`,
          { waitUntil: 'domcontentloaded' },
        );
        try {
          await page.waitForURL((url) => !url.pathname.includes('/sign-in'), {
            timeout: 30_000,
          });
        } catch (error) {
          throw new Error(
            `The ${label} Clerk sign-in ticket did not establish a session at ${baseURL}.`,
            { cause: error },
          );
        }
        if (page.url().includes('/sign-in')) {
          throw new Error(`The ${label} Clerk sign-in ticket was rejected at ${baseURL}.`);
        }
        await context.storageState({ path: filePath });
      } finally {
        await context.close();
      }
    }

    async function verifyAdminStorageState(filePath, expectedRole, email) {
      const context = await browser.newContext({ storageState: filePath });
      try {
        const page = await context.newPage();
        const adminMeResponsePromise = page.waitForResponse(
          (response) =>
            response.url().includes('/api/admin/me') &&
            response.request().method() === 'GET',
          { timeout: 30_000 },
        );
        await page.goto(`${baseURL}/admin`, { waitUntil: 'domcontentloaded' });
        const response = await adminMeResponsePromise;
        const body = await response.json().catch(() => null);
        if (
          response.status() !== 200 ||
          !body?.authenticated ||
          body.role !== expectedRole ||
          body.user?.role !== expectedRole
        ) {
          throw new Error(
            `The Clerk user ${email} has a valid session but is not authorized as a local ${expectedRole} (received role "${body?.role ?? 'unknown'}").`,
          );
        }
      } finally {
        await context.close();
      }
    }

    async function verifyNonAdminIsHidden(filePath, email) {
      const context = await browser.newContext({ storageState: filePath });
      try {
        const page = await context.newPage();
        const response = await page.request.get('/api/admin/me');
        const body = await response.json().catch(() => null);
        if (response.status() !== 404 || body?.error !== 'Not found') {
          throw new Error(
            `The non-administrator Clerk user ${email} can inspect the admin identity endpoint.`,
          );
        }
        await page.goto(`${baseURL}/admin`, { waitUntil: 'domcontentloaded' });
        await page.getByTestId('link-not-found-home').waitFor({ state: 'visible', timeout: 30_000 });
      } finally {
        await context.close();
      }
    }

    const [seller, secondSeller, admin, moderator, secondaryAdmin] = await Promise.all([
      ensureUser({ email: sellerEmail, firstName: 'E2E', lastName: 'Seller' }),
      ensureUser({
        email: secondSellerEmail,
        firstName: 'E2E',
        lastName: 'Second Seller',
      }),
      configuredAdminUserId
        ? clerkRequest(`/users/${configuredAdminUserId}`)
        : ensureUser({ email: adminEmail, firstName: 'E2E', lastName: 'Admin', role: 'admin' }),
      ensureUser({
        email: moderatorEmail,
        firstName: 'E2E',
        lastName: 'Moderator',
        role: 'moderator',
      }),
      ensureUser({
        email: secondaryAdminEmail,
        firstName: 'E2E',
        lastName: 'Secondary Admin',
        role: 'admin',
      }),
    ]);

    await writeStorageState(seller, sellerStorageState, 'seller');
    await writeStorageState(secondSeller, secondSellerStorageState, 'second seller');
    await writeStorageState(admin, adminStorageState, 'admin');
    await writeStorageState(moderator, moderatorStorageState, 'moderator');
    await writeStorageState(secondaryAdmin, secondaryAdminStorageState, 'secondary admin');
    await verifyAdminStorageState(adminStorageState, 'admin', adminEmail);
    if (process.env.E2E_SKIP_MODERATOR_VERIFICATION !== '1') {
      await verifyNonAdminIsHidden(moderatorStorageState, moderatorEmail);
    }
    console.log(
      'Refreshed Playwright storage states for test seller, admin, moderator, and secondary admin identities.',
    );
  } finally {
    await browser?.close();
  }
}

export default setupAuth;

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  setupAuth().catch((error) => {
    console.error(`Payment review E2E setup failed: ${errorMessage(error)}`);
    process.exitCode = 1;
  });
}