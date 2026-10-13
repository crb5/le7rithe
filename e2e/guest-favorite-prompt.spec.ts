import { expect, test } from '@playwright/test';

test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});

test('guest save prompt stays in place until sign-in is explicitly chosen', async ({ page }) => {
  await page.goto('/');
  const saveButton = page.locator('[data-testid^="button-save-"]:visible').first();
  await expect(saveButton).toBeVisible();
  await saveButton.scrollIntoViewIfNeeded();
  const bounds = await saveButton.boundingBox();
  expect(bounds).not.toBeNull();

  const initialPath = new URL(page.url()).pathname;
  const initialScrollY = await page.evaluate(() => window.scrollY);
  await page.touchscreen.tap(
    bounds!.x + bounds!.width / 2,
    bounds!.y + bounds!.height / 2,
  );

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  expect(new URL(page.url()).pathname).toBe(initialPath);
  const lockState = await page.evaluate(() => ({
    position: document.body.style.position,
    top: document.body.style.top,
  }));
  expect(lockState).toEqual({ position: 'fixed', top: `-${initialScrollY}px` });

  await page.getByTestId('button-cancel-favorite-sign-in').click();
  await expect(dialog).toBeHidden();
  expect(await page.evaluate(() => window.scrollY)).toBe(initialScrollY);

  const secondBounds = await saveButton.boundingBox();
  expect(secondBounds).not.toBeNull();
  await page.touchscreen.tap(
    secondBounds!.x + secondBounds!.width / 2,
    secondBounds!.y + secondBounds!.height / 2,
  );
  await expect(dialog).toBeVisible();
  await page.getByTestId('button-confirm-favorite-sign-in').click();
  await expect(page).toHaveURL(/\/sign-in\?redirect_url=%2F/);
});
