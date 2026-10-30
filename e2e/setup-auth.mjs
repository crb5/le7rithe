import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { ensureSignedIn } from './authentik-session.mjs';
import { seller, secondSeller, admin, moderator, secondaryAdmin } from './personas.mjs';

const authDir = resolve(process.cwd(), 'e2e/.auth');

const sellerStorageState = process.env.E2E_SELLER_STORAGE_STATE ?? resolve(authDir, 'seller.json');
const secondSellerStorageState = process.env.E2E_SECOND_SELLER_STORAGE_STATE ?? resolve(authDir, 'second-seller.json');
const adminStorageState = process.env.E2E_ADMIN_STORAGE_STATE ?? resolve(authDir, 'admin.json');
const moderatorStorageState = process.env.E2E_MODERATOR_STORAGE_STATE ?? resolve(authDir, 'moderator.json');
const secondaryAdminStorageState = process.env.E2E_SECONDARY_ADMIN_STORAGE_STATE ?? resolve(authDir, 'admin-secondary.json');

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

async function setupAuth() {
  const baseURL =
    process.env.E2E_BASE_URL ??
    (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : undefined);

  if (process.env.NODE_ENV === 'production') {
    throw new Error('E2E auth setup is disabled in production.');
  }
  if (!baseURL) {
    throw new Error('E2E_BASE_URL (or REPLIT_DEV_DOMAIN) is required to provision E2E sessions.');
  }
  const target = new URL(baseURL);
  const isLocalTarget = ['localhost', '127.0.0.1', '[::1]'].includes(target.hostname);
  const isReplitPreview = target.hostname.endsWith('.replit.dev');
  if ((!isLocalTarget && !isReplitPreview) || target.username || target.password) {
    throw new Error('E2E auth setup only allows localhost or a Replit development preview URL.');
  }

  let browser;
  try {
    await mkdir(authDir, { recursive: true });
    await Promise.all(
      [sellerStorageState, secondSellerStorageState, adminStorageState, moderatorStorageState, secondaryAdminStorageState]
        .map((filePath) => mkdir(dirname(resolve(filePath)), { recursive: true })),
    );
    browser = await chromium.launch({
      headless: true,
      executablePath: process.env.REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    });

    async function writeStorageState(p, filePath, label) {
      const context = await browser.newContext({ baseURL });
      try {
        const page = await context.newPage();
        try {
          await ensureSignedIn(page, p);
        } catch (error) {
          throw new Error(`Could not establish a session for the ${label} (${p.username}) at ${baseURL}.`, { cause: error });
        }
        await context.storageState({ path: filePath });
      } finally {
        await context.close();
      }
    }

    async function verifyAdminStorageState(filePath, expectedRole, email) {
      const context = await browser.newContext({ baseURL, storageState: filePath });
      try {
        const page = await context.newPage();
        const adminMeResponsePromise = page.waitForResponse(
          (response) => response.url().includes('/api/admin/me') && response.request().method() === 'GET',
          { timeout: 30_000 },
        );
        await page.goto('/admin', { waitUntil: 'domcontentloaded' });
        const response = await adminMeResponsePromise;
        const body = await response.json().catch(() => null);
        if (
          response.status() !== 200 ||
          !body?.authenticated ||
          body.role !== expectedRole ||
          body.user?.role !== expectedRole
        ) {
          throw new Error(
            `The account ${email} has a valid session but is not authorized as a local ${expectedRole} ` +
            `(received role "${body?.role ?? 'unknown'}"). Check that this email is in the target server's ` +
            `ADMIN_ALLOWED_EMAILS${expectedRole === 'moderator' ? ', and that it has been manually promoted to moderator' : ''}.`,
          );
        }
      } finally {
        await context.close();
      }
    }

    async function verifyNonAdminIsHidden(filePath, email) {
      const context = await browser.newContext({ baseURL, storageState: filePath });
      try {
        const page = await context.newPage();
        const response = await page.request.get('/api/admin/me');
        const body = await response.json().catch(() => null);
        if (response.status() !== 404 || body?.error !== 'Not found') {
          throw new Error(`The non-administrator account ${email} can inspect the admin identity endpoint.`);
        }
        await page.goto('/admin', { waitUntil: 'domcontentloaded' });
        await page.getByTestId('link-not-found-home').waitFor({ state: 'visible', timeout: 30_000 });
      } finally {
        await context.close();
      }
    }

    await writeStorageState(seller, sellerStorageState, 'seller');
    await writeStorageState(secondSeller, secondSellerStorageState, 'second seller');
    await writeStorageState(admin, adminStorageState, 'admin');
    await writeStorageState(moderator, moderatorStorageState, 'moderator');
    await writeStorageState(secondaryAdmin, secondaryAdminStorageState, 'secondary admin');
    await verifyAdminStorageState(adminStorageState, 'admin', admin.email);
    if (process.env.E2E_SKIP_MODERATOR_VERIFICATION !== '1') {
      await verifyNonAdminIsHidden(moderatorStorageState, moderator.email);
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
    console.error(`E2E auth setup failed: ${errorMessage(error)}`);
    process.exitCode = 1;
  });
}
