import { expect, test, type Locator, type Page } from '@playwright/test';
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
const missingMarketplaceConfiguration = !baseURL || !existsSync(sellerStorageState);
const missingAdminConfiguration = !baseURL || !existsSync(adminStorageState);

test.use({ video: 'off' });

async function expectDialogFitsViewport(page: Page) {
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  const box = await dialog.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height);
  return dialog;
}

async function openMarketplaceSignOut(
  page: Page,
  trigger: 'button-sidebar-sign-out',
  openMenu: boolean,
) {
  await page.goto('/');
  await page.addStyleTag({
    content: '#replit-dev-banner, #replit-dev-banner * { pointer-events: none !important; }',
  });
  if ((page.viewportSize()?.width ?? 0) < 640) {
    await expect(page.getByTestId('button-open-menu')).toBeVisible();
    await expect(page.getByTestId('link-header-brand')).toBeVisible();
    await expect(page.getByTestId('link-header-brand')).toContainText('le7rithe');
    await expect(page.getByTestId('select-language')).toBeVisible();
    await expect(page.getByTestId('link-header-notifications')).toHaveCount(0);
    await expect(page.getByTestId('link-nav-notifications')).toHaveCount(1);
    await expect(page.getByTestId('button-header-sign-out')).toBeHidden();
    await expect(page.getByTestId('link-header-account')).toBeHidden();
    await expect(page.locator('header')).toContainText('le7rithe');
    await expect(page.getByTestId('link-header-brand').locator('.sh-tagline')).toHaveCount(0);
    await expect(page.getByTestId('link-floating-support')).toBeVisible();
    await expect(page.getByTestId('link-mobile-add')).toBeVisible();
    const supportBox = await page.getByTestId('link-floating-support').boundingBox();
    const addBox = await page.getByTestId('link-mobile-add').boundingBox();
    expect(supportBox).not.toBeNull();
    expect(addBox).not.toBeNull();
    expect(supportBox!.height).toBeGreaterThanOrEqual(44);
    expect(addBox!.height).toBeGreaterThanOrEqual(44);
    expect(supportBox!.y + supportBox!.height).toBeLessThanOrEqual(addBox!.y);
    const homePaddingBottom = await page.locator('main').evaluate((element) => {
      const view = element.ownerDocument.defaultView;
      return Number.parseFloat(view?.getComputedStyle(element).paddingBottom ?? '0');
    });
    expect(homePaddingBottom).toBeGreaterThanOrEqual(100);
  }
  const triggerButton = page.getByTestId(trigger);
  if (openMenu) {
    await page.getByTestId('button-open-menu').click();
    await expect(page.getByTestId('link-nav-notifications')).toBeVisible();
    await expect(
      page.locator('#marketplace-navigation-drawer').getByText('le7rithe', { exact: true }),
    ).toBeVisible();
  }
  await expect(triggerButton).toBeVisible();
  await triggerButton.click();
  return { dialog: await expectDialogFitsViewport(page), triggerButton };
}

async function exerciseConfirmation(
  page: Page,
  triggerButton: Locator,
  confirm = true,
) {
  const dialog = page.getByRole('dialog');

  const secondaryCancelButton = dialog.getByTestId('button-cancel-sign-out-secondary');

  await expect(secondaryCancelButton).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(triggerButton).toBeFocused();

  await triggerButton.click();
  const reopenedDialog = await expectDialogFitsViewport(page);
  const reopenedSecondaryCancelButton = reopenedDialog.getByTestId('button-cancel-sign-out-secondary');
  const reopenedCloseButton = reopenedDialog.getByTestId('button-cancel-sign-out');
  const reopenedConfirmButton = reopenedDialog.getByTestId('button-confirm-sign-out');
  await expect(reopenedSecondaryCancelButton).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(reopenedConfirmButton).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(reopenedSecondaryCancelButton).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(reopenedCloseButton).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(reopenedSecondaryCancelButton).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(reopenedDialog).toBeHidden();
  await expect(triggerButton).toBeVisible();

  if (!confirm) return;

  await triggerButton.click();
  const confirmedDialog = await expectDialogFitsViewport(page);
  await expect(confirmedDialog.getByTestId('button-cancel-sign-out-secondary')).toBeFocused();
  const signInNavigation = page.waitForURL(signInPath, { timeout: 30_000 });
  await page.keyboard.press('Tab');
  await expect(confirmedDialog.getByTestId('button-confirm-sign-out')).toBeFocused();
  await page.keyboard.press('Enter');
  await signInNavigation;
}

function signInPath(url: URL) {
  return url.pathname.includes('/sign-in');
}

test.describe('marketplace logout confirmation', () => {
  test.skip(
    missingMarketplaceConfiguration,
    'Set E2E_BASE_URL (or REPLIT_DEV_DOMAIN) and create the seller storage state with yarn setup:e2e-auth to run the logout regression.',
  );

  test.use({ storageState: sellerStorageState });

  for (const scenario of [
    { name: 'sidebar control with desktop drawer open', width: 1280, trigger: 'button-sidebar-sign-out' as const, openMenu: true, confirm: false },
    { name: 'sidebar control at mobile width', width: 390, trigger: 'button-sidebar-sign-out' as const, openMenu: true, confirm: false },
    { name: 'sidebar control with desktop confirmation', width: 1280, trigger: 'button-sidebar-sign-out' as const, openMenu: true, confirm: true },
  ]) {
    test(`requires confirmation for the ${scenario.name}`, async ({ page }) => {
      await page.setViewportSize({ width: scenario.width, height: 844 });
      const { triggerButton } = await openMarketplaceSignOut(page, scenario.trigger, scenario.openMenu);

      await exerciseConfirmation(page, triggerButton, scenario.confirm);
    });
  }
});

test.describe('administrator logout confirmation', () => {
  test.skip(
    missingAdminConfiguration,
    'Set E2E_BASE_URL (or REPLIT_DEV_DOMAIN) and create the administrator storage state with yarn setup:e2e-auth to run the logout regression.',
  );

  test.use({ storageState: adminStorageState });

  for (const width of [1280, 390]) {
    test(`requires confirmation at ${width}px width`, async ({ page }) => {
      const adminMeResponse = await page.request.get('/api/admin/me');
      const adminMe = (await adminMeResponse.json().catch(() => null)) as { role?: string } | null;
      if (
        adminMeResponse.status() !== 200 ||
        adminMe?.role !== 'admin'
      ) {
        test.skip(
          true,
          'The configured administrator session is not authorized for the local admin portal; refresh the Clerk storage state and local administrator role before this regression.',
        );
      }

      await page.setViewportSize({ width, height: 844 });
      await page.goto('/admin');
      await page.addStyleTag({
        content: '#replit-dev-banner, #replit-dev-banner * { pointer-events: none !important; }',
      });

      const triggerButton = page.getByTestId('button-admin-sign-out');
      if (width < 1024) {
        await page.getByTestId('button-open-admin-menu').click();
      }
      await expect(triggerButton).toBeVisible();
      await triggerButton.click();
      await expectDialogFitsViewport(page);

      await exerciseConfirmation(page, triggerButton, width === 390);
    });
  }
});