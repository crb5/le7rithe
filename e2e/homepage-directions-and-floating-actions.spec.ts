import { expect, test, type Browser, type Page } from '@playwright/test';
import { ensureSignedIn } from './authentik-session.mjs';
import { seller } from './personas.mjs';

const baseURL =
  process.env.E2E_BASE_URL ??
  (process.env.REPLIT_DEV_DOMAIN
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : undefined);
const mobileViewport = { width: 390, height: 844 };
const localeCases = [
  { language: 'ar', direction: 'rtl' },
  { language: 'fr', direction: 'ltr' },
  { language: 'en', direction: 'ltr' },
] as const;

async function useMobilePage(browser: Browser) {
  const context = await browser.newContext({
    viewport: mobileViewport,
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  });
  return { context, page: await context.newPage() };
}

async function setLocale(page: Page, language: (typeof localeCases)[number]['language']) {
  await page.evaluate((value) => {
    window.localStorage.setItem('marketplace-language', value);
  }, language);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('html')).toHaveAttribute('lang', language);
}

async function expectFloatingVisibility(
  page: Page,
  state: 'visible' | 'hidden',
  testIds = ['link-mobile-add', 'link-floating-support'],
) {
  for (const testId of testIds) {
    const action = page.getByTestId(testId);
    await expect(action).toHaveAttribute('data-floating-visibility', state);
    await expect(action).toHaveAttribute('aria-hidden', state === 'hidden' ? 'true' : 'false');
  }
}

async function checkHideRevealCycle(
  page: Page,
  testIds = ['link-mobile-add', 'link-floating-support'],
) {
  const originalY = new Map<string, number>();
  for (const testId of testIds) {
    const box = await page.getByTestId(testId).boundingBox();
    expect(box, `${testId} should be visible before scrolling`).not.toBeNull();
    originalY.set(testId, box!.y);
  }

  await page.evaluate(() => window.scrollTo(0, 220));
  await expectFloatingVisibility(page, 'hidden', testIds);
  for (const testId of testIds) {
    const action = page.getByTestId(testId);
    await expect.poll(() => action.evaluate((element) => getComputedStyle(element).opacity)).toBe('0');
    await expect.poll(async () => {
      const box = await action.boundingBox();
      return box !== null && Math.abs(box.y - originalY.get(testId)! - 12) < 0.5;
    }).toBe(true);
    const hiddenStyles = await action.evaluate((element) => ({
      opacity: getComputedStyle(element).opacity,
      pointerEvents: getComputedStyle(element).pointerEvents,
    }));
    expect(hiddenStyles, `${testId} should be hidden and non-interactive`).toMatchObject({
      opacity: '0',
      pointerEvents: 'none',
    });
  }

  await page.evaluate(() => window.scrollTo(0, 205));
  await expectFloatingVisibility(page, 'visible', testIds);
  for (const testId of testIds) {
    const action = page.getByTestId(testId);
    await expect.poll(() => action.evaluate((element) => getComputedStyle(element).opacity)).toBe('1');
    await expect.poll(async () => {
      const box = await action.boundingBox();
      return box !== null && Math.abs(box.y - originalY.get(testId)!) < 0.5;
    }).toBe(true);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await expectFloatingVisibility(page, 'visible', testIds);
}

test.describe('homepage directions and floating actions on mobile', () => {
  test.skip(!baseURL, 'Set E2E_BASE_URL or REPLIT_DEV_DOMAIN to run the mobile homepage regression.');

  test('section arrows follow the locale and the add button hides on scroll down', async ({ browser }) => {
    const { context, page } = await useMobilePage(browser);
    try {
      await page.goto('/');
      const arrows = page.locator('[data-testid^="link-section-"] [data-direction]');

      for (const locale of localeCases) {
        await setLocale(page, locale.language);
        await expect(page.locator('[data-testid="section-latest-offers"] [data-direction]'))
          .toHaveAttribute('data-direction', locale.direction);

        const sectionArrowDirections = await arrows.evaluateAll((elements) =>
          elements.map((element) => element.getAttribute('data-direction')),
        );
        expect(sectionArrowDirections.length).toBeGreaterThan(0);
        expect(sectionArrowDirections.every((direction) => direction === locale.direction)).toBe(true);

        const addButton = page.getByTestId('link-mobile-add');
        await expect(addButton).toHaveAttribute('data-floating-visibility', 'visible');
        await page.evaluate(() => window.scrollTo(0, 13));
        await expect(addButton).toHaveAttribute('data-floating-visibility', 'hidden');
        await page.evaluate(() => window.scrollTo(0, 5));
        await expect(addButton).toHaveAttribute('data-floating-visibility', 'visible');
        await checkHideRevealCycle(page, ['link-mobile-add']);
      }

      const mobileContentPadding = await page.locator('main').evaluate(
        (element) => Number.parseFloat(getComputedStyle(element).paddingBottom),
      );
      expect(mobileContentPadding).toBeGreaterThanOrEqual(144);
    } finally {
      await context.close();
    }
  });

  test.skip(
    !baseURL,
    'Set E2E_BASE_URL (or REPLIT_DEV_DOMAIN) to check signed-in support controls.',
  );

  test('the support and add buttons keep their positions and hide/reappear in all three locales', async ({ browser }) => {
    const { context, page } = await useMobilePage(browser);
    try {
      await ensureSignedIn(page, seller);
      await expect.poll(async () => (await page.request.get('/api/account/me')).status()).toBe(200);
      await page.goto('/');

      const supportButton = page.getByTestId('link-floating-support');
      const addButton = page.getByTestId('link-mobile-add');
      for (const locale of localeCases) {
        await setLocale(page, locale.language);
        await expectFloatingVisibility(page, 'visible');

        const [supportBox, addBox] = await Promise.all([
          supportButton.boundingBox(),
          addButton.boundingBox(),
        ]);
        expect(supportBox).not.toBeNull();
        expect(addBox).not.toBeNull();
        const supportStart = locale.direction === 'rtl'
          ? mobileViewport.width - supportBox!.x - supportBox!.width
          : supportBox!.x;
        const addStart = locale.direction === 'rtl'
          ? mobileViewport.width - addBox!.x - addBox!.width
          : addBox!.x;
        expect(supportStart).toBeCloseTo(12, 0);
        expect(addStart).toBeCloseTo(12, 0);
        expect(mobileViewport.height - supportBox!.y - supportBox!.height).toBeCloseTo(72, 0);
        expect(mobileViewport.height - addBox!.y - addBox!.height).toBeCloseTo(20, 0);

        await checkHideRevealCycle(page);
      }
    } finally {
      await context.close();
    }
  });
});
