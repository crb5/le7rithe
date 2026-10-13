import { expect, test, type Page } from '@playwright/test';

const baseURL =
  process.env.E2E_BASE_URL ??
  (process.env.REPLIT_DEV_DOMAIN
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : undefined);

async function prepareScrollablePage(page: Page) {
  await page.goto('/listings');
  await page.addStyleTag({
    content: '#replit-dev-banner, #replit-dev-banner * { pointer-events: none !important; }',
  });
  await expect(page.getByTestId('input-search')).toBeVisible();

  const maxScroll = await page.evaluate(
    () => document.documentElement.scrollHeight - window.innerHeight,
  );
  expect(maxScroll).toBeGreaterThan(180);

  const scrollBeforeMenu = Math.min(240, maxScroll - 1);
  await page.evaluate((y) => window.scrollTo(0, y), scrollBeforeMenu);
  await expect(page.getByTestId('marketplace-header')).toHaveAttribute('data-header-state', 'hidden');

  const scrollAtMenuOpen = Math.max(40, scrollBeforeMenu - 30);
  await page.evaluate((y) => window.scrollTo(0, y), scrollAtMenuOpen);
  await expect(page.getByTestId('marketplace-header')).toHaveAttribute('data-header-state', 'visible');
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(scrollAtMenuOpen);
}

async function dragTouch(
  cdp: Awaited<ReturnType<import('@playwright/test').BrowserContext['newCDPSession']>>,
  x: number,
  startY: number,
  endY: number,
) {
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x, y: startY, id: 1 }],
  });

  for (let step = 1; step <= 6; step += 1) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x, y: startY + ((endY - startY) * step) / 6, id: 1 }],
    });
    await new Promise((resolve) => setTimeout(resolve, 24));
  }

  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
}

test.describe('marketplace sidebar scroll lock', () => {
  test.skip(!baseURL, 'Set E2E_BASE_URL to run the sidebar scroll-lock regression.');

  test('locks the desktop page, keeps sidebar wheel scrolling, and restores position on repeated closes', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await prepareScrollablePage(page);

    const menuButton = page.getByTestId('button-open-menu');
    const drawer = page.locator('#marketplace-navigation-drawer');
    const main = page.locator('main');
    const originalState = await page.evaluate(() => ({
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      bodyPosition: document.body.style.position,
      bodyTop: document.body.style.top,
      bodyLeft: document.body.style.left,
      bodyWidth: document.body.style.width,
      bodyPaddingRight: document.body.style.paddingRight,
      htmlOverflow: document.documentElement.style.overflow,
    }));
    const mainTopBefore = await main.evaluate((element) => element.getBoundingClientRect().top);

    for (const closeMethod of ['button', 'escape', 'overlay'] as const) {
      await menuButton.click();
      await expect(drawer).toHaveAttribute('aria-hidden', 'false');
      await expect.poll(() => page.evaluate(() => document.body.style.position)).toBe('fixed');
      await expect.poll(() => page.evaluate(() => document.body.style.top))
        .toBe(`${-originalState.scrollY}px`);
      expect(await main.evaluate((element) => element.getBoundingClientRect().top))
        .toBe(mainTopBefore);

      const drawerBox = await drawer.boundingBox();
      expect(drawerBox).not.toBeNull();
      const outsideX = drawerBox!.x > 0
        ? Math.max(1, drawerBox!.x - 12)
        : Math.min(1278, drawerBox!.x + drawerBox!.width + 12);
      const outsideY = 420;
      await page.mouse.move(outsideX, outsideY);
      await page.mouse.wheel(0, 500);
      await page.waitForTimeout(100);
      expect(await page.evaluate(() => document.body.style.top)).toBe(`${-originalState.scrollY}px`);
      expect(await main.evaluate((element) => element.getBoundingClientRect().top)).toBe(mainTopBefore);

      const sidebarScroll = await drawer.evaluate((element) => ({
        top: element.scrollTop,
        max: element.scrollHeight - element.clientHeight,
        x: element.getBoundingClientRect().left + element.clientWidth / 2,
        y: element.getBoundingClientRect().top + element.clientHeight / 2,
      }));
      if (sidebarScroll.max > 1) {
        await drawer.evaluate((element) => {
          element.scrollTop = 0;
        });
        await page.mouse.move(sidebarScroll.x, sidebarScroll.y);
        await page.mouse.wheel(0, 300);
        await expect.poll(() => drawer.evaluate((element) => element.scrollTop))
          .toBeGreaterThan(0);
        expect(await page.evaluate(() => document.body.style.top)).toBe(`${-originalState.scrollY}px`);
      }

      if (closeMethod === 'button') {
        await page.getByTestId('button-close-menu').click();
      } else if (closeMethod === 'escape') {
        await page.keyboard.press('Escape');
      } else {
        await page.getByTestId('button-overlay-menu').click({ position: { x: 5, y: 500 } });
      }

      await expect(drawer).toHaveAttribute('aria-hidden', 'true');
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(originalState.scrollY);
      expect(await page.evaluate(() => ({
        bodyPosition: document.body.style.position,
        bodyTop: document.body.style.top,
        bodyLeft: document.body.style.left,
        bodyWidth: document.body.style.width,
        bodyPaddingRight: document.body.style.paddingRight,
        htmlOverflow: document.documentElement.style.overflow,
      }))).toEqual({
        bodyPosition: originalState.bodyPosition,
        bodyTop: originalState.bodyTop,
        bodyLeft: originalState.bodyLeft,
        bodyWidth: originalState.bodyWidth,
        bodyPaddingRight: originalState.bodyPaddingRight,
        htmlOverflow: originalState.htmlOverflow,
      });
      await expect(menuButton).toBeFocused();
    }
  });

  test('blocks background touch swipes while allowing sidebar touch scrolling on a phone viewport', async ({
    browser,
  }) => {
    const context = await browser.newContext({
      baseURL,
      viewport: { width: 390, height: 740 },
      isMobile: true,
      hasTouch: true,
    });

    try {
      const page = await context.newPage();
      await prepareScrollablePage(page);

      const menuButton = page.getByTestId('button-open-menu');
      const drawer = page.locator('#marketplace-navigation-drawer');
      const originalScrollY = await page.evaluate(() => window.scrollY);
      const mainTopBefore = await page.locator('main').evaluate(
        (element) => element.getBoundingClientRect().top,
      );
      const cdp = await context.newCDPSession(page);

      const openMenuByTouch = async () => {
        const box = await menuButton.boundingBox();
        expect(box).not.toBeNull();
        await page.touchscreen.tap(box!.x + box!.width / 2, box!.y + box!.height / 2);
        await expect(drawer).toHaveAttribute('aria-hidden', 'false');
      };

      const closeMenuByTouch = async () => {
        await drawer.evaluate((element) => {
          element.scrollTop = 0;
        });
        const closeButton = page.getByTestId('button-close-menu');
        await expect(closeButton).toBeVisible();
        const box = await closeButton.boundingBox();
        expect(box).not.toBeNull();
        await page.touchscreen.tap(box!.x + box!.width / 2, box!.y + box!.height / 2);
        await expect(drawer).toHaveAttribute('aria-hidden', 'true');
        await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(originalScrollY);
        await expect(menuButton).toBeFocused();
      };

      await openMenuByTouch();
      const initialDrawerMetrics = await drawer.evaluate((element) => ({
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight,
        x: element.getBoundingClientRect().x,
        width: element.getBoundingClientRect().width,
        y: element.getBoundingClientRect().y,
        height: element.getBoundingClientRect().height,
      }));
      expect(initialDrawerMetrics.scrollHeight).toBeGreaterThan(initialDrawerMetrics.clientHeight);
      await expect.poll(() => page.getByTestId('button-overlay-menu').evaluate(
        (element) => getComputedStyle(element).touchAction,
      )).toBe('none');

      const outsideX = initialDrawerMetrics.x > 0
        ? Math.max(1, initialDrawerMetrics.x - 12)
        : Math.min(388, initialDrawerMetrics.x + initialDrawerMetrics.width + 12);
      await dragTouch(cdp, outsideX, 620, 360);
      await expect.poll(() => page.evaluate(() => document.body.style.position)).toBe('fixed');
      expect(await page.evaluate(() => document.body.style.top)).toBe(`${-originalScrollY}px`);
      expect(await page.locator('main').evaluate(
        (element) => element.getBoundingClientRect().top,
      )).toBe(mainTopBefore);

      const sidebarTouchX = initialDrawerMetrics.x > 0
        ? initialDrawerMetrics.x + initialDrawerMetrics.width - 5
        : initialDrawerMetrics.x + 5;
      await dragTouch(
        cdp,
        sidebarTouchX,
        initialDrawerMetrics.y + initialDrawerMetrics.height - 30,
        initialDrawerMetrics.y + initialDrawerMetrics.height - 240,
      );
      await expect.poll(() => drawer.evaluate((element) => element.scrollTop))
        .toBeGreaterThan(0);
      await expect(page).toHaveURL(/\/listings$/);
      expect(await page.evaluate(() => document.body.style.top)).toBe(`${-originalScrollY}px`);

      await drawer.evaluate((element) => {
        element.scrollTop = 0;
      });
      await closeMenuByTouch();
      await openMenuByTouch();
      await dragTouch(cdp, outsideX, 620, 360);
      expect(await page.evaluate(() => document.body.style.top)).toBe(`${-originalScrollY}px`);
      await closeMenuByTouch();
    } finally {
      await context.close();
    }
  });
});