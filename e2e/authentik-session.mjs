// Establishes an authenticated Playwright session against the real
// Authentik-driven /sign-in and /sign-up pages (see
// artifacts/agri-market/src/pages/sign-in.tsx, sign-up.tsx) — replaces the
// old Clerk sign-in-ticket shortcut, which no longer applies post-migration.
//
// There's no equivalent "mint a session for an existing user id via API"
// shortcut for Authentik here (that would need its separate admin REST API),
// so this drives the real UI instead: sign in with username/password, or
// self-register via /sign-up first if the account doesn't exist yet.

/**
 * @param {import('@playwright/test').Page} page
 * @param {number} timeoutMs
 */
async function isAuthenticated(page, timeoutMs) {
  try {
    await page.waitForURL((url) => !url.pathname.includes('/sign-in') && !url.pathname.includes('/sign-up'), {
      timeout: timeoutMs,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Signs in with an existing username/password. Throws if the credentials
 * don't work (the page stays on /sign-in with a visible error).
 * @param {import('@playwright/test').Page} page
 * @param {{ username: string, password: string }} creds
 */
export async function signIn(page, creds) {
  await page.goto('/sign-in', { waitUntil: 'domcontentloaded' });
  await page.fill('#sign-in-uid', creds.username);
  await page.fill('#sign-in-password', creds.password);
  await page.click('button[type="submit"]');
  const ok = await isAuthenticated(page, 20_000);
  if (!ok) {
    throw new Error(`Could not sign in as "${creds.username}" — check the account exists and the password is correct.`);
  }
}

/**
 * Registers a new account through the real sign-up form.
 * @param {import('@playwright/test').Page} page
 * @param {{ username: string, password: string, name: string, email: string, phone?: string }} details
 */
export async function signUp(page, details) {
  await page.goto('/sign-up', { waitUntil: 'domcontentloaded' });
  await page.fill('#sign-up-username', details.username);
  await page.fill('#sign-up-name', details.name);
  await page.fill('#sign-up-email', details.email);
  await page.fill('#sign-up-phone', details.phone ?? '+222 30 00 00 01');
  await page.fill('#sign-up-password', details.password);
  await page.fill('#sign-up-password-repeat', details.password);
  await page.locator('input[type="checkbox"]').check();
  await page.click('button[type="submit"]');
  const ok = await isAuthenticated(page, 20_000);
  if (!ok) {
    const errorText = await page.locator('[role="alert"]').first().textContent().catch(() => null);
    throw new Error(`Sign-up for "${details.username}" did not complete${errorText ? `: ${errorText}` : '.'}`);
  }
}

/**
 * Signs in if the account already exists, otherwise registers it first.
 * This is what setup scripts should use so re-runs are idempotent.
 * @param {import('@playwright/test').Page} page
 * @param {{ username: string, password: string, name: string, email: string, phone?: string }} details
 */
export async function ensureSignedIn(page, details) {
  try {
    await signIn(page, details);
    return;
  } catch {
    // Account likely doesn't exist yet — fall through to registration.
  }
  await signUp(page, details);
}
