import { expect, test, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const defaultAuthDir = resolve(process.cwd(), 'e2e/.auth');
const sellerStorageState =
  process.env.E2E_SELLER_STORAGE_STATE ?? resolve(defaultAuthDir, 'seller.json');
const baseURL =
  process.env.E2E_BASE_URL ??
  (process.env.REPLIT_DEV_DOMAIN
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : undefined);
const missingConfiguration = !baseURL || !existsSync(sellerStorageState);

const listings = Array.from({ length: 6 }, (_, index) => ({
  id: index + 1,
  title: `Featured listing ${index + 1}`,
  category: 'Agricultural machinery',
  categorySlug: 'tractors',
  subcategory: null,
  subcategorySlug: null,
  price: 1000 + index,
  currency: 'MRU',
  location: 'Nouakchott',
  condition: 'used' as const,
  year: 2020,
  manufacturer: null,
  model: null,
  hours: null,
  area: null,
  waterAvailable: null,
  electricityAvailable: null,
  ownershipType: null,
  contactPhone: null,
  attributes: {},
  description: 'A featured listing used by the marquee interaction regression.',
  imageUrl: '',
  images: [],
  seller: {
    id: index + 1,
    name: 'Test seller',
    initials: 'TS',
    verified: true,
    phone: null,
  },
  createdAt: new Date().toISOString(),
  expiresAt: null,
  featured: true,
  isSaved: false,
}));

async function mockMarketplaceData(page: Page) {
  await page.route('**/api/listings**', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: listings,
        total: listings.length,
        page: 1,
        limit: 8,
      }),
    });
  });
  await page.route('**/api/categories', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  await page.route('**/api/locations', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
}

async function transformX(page: Page) {
  return page.getByTestId('featured-listings-marquee').locator('.featured-marquee__track').evaluate((track) => {
    const transform = (track as any).ownerDocument.defaultView.getComputedStyle(track).transform;
    if (transform === 'none') return 0;
    const values = transform.match(/matrix3d\(([^)]+)\)/)?.[1] ?? transform.match(/matrix\(([^)]+)\)/)?.[1];
    if (!values) return 0;
    const parts = values.split(',').map(Number);
    return transform.startsWith('matrix3d') ? parts[12] : parts[4];
  });
}

async function pageHorizontalOverflow(page: Page) {
  return page.evaluate(() => {
    const { document: doc, window: win } = globalThis as any;
    const measure = (selector: string) => {
      const element = doc.querySelector(selector);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return {
        width: rect.width,
        left: rect.left,
        right: rect.right,
      };
    };
    return {
      bodyScrollWidth: doc.body.scrollWidth,
      documentScrollWidth: doc.documentElement.scrollWidth,
      viewportWidth: win.innerWidth,
      scrollX: win.scrollX,
      root: measure('#root'),
      main: measure('main'),
    };
  });
}

async function expectNoHorizontalPageScroll(page: Page) {
  const dimensions = await pageHorizontalOverflow(page);
  expect(dimensions.bodyScrollWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
  expect(dimensions.documentScrollWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
  expect(dimensions.scrollX).toBe(0);
  for (const [selector, box] of Object.entries({ '#root': dimensions.root, main: dimensions.main })) {
    expect(box, `${selector} should exist`).not.toBeNull();
    expect(box!.width, `${selector} should fill the viewport`).toBeCloseTo(dimensions.viewportWidth, 0);
    expect(box!.left, `${selector} should start at the viewport edge`).toBeCloseTo(0, 0);
    expect(box!.right, `${selector} should end at the viewport edge`).toBeCloseTo(dimensions.viewportWidth, 0);
  }
}

async function expectMarqueeContained(page: Page) {
  const marquee = page.getByTestId('featured-listings-marquee');
  const main = page.locator('main');
  const marqueeBox = await marquee.boundingBox();
  const mainBox = await main.boundingBox();

  expect(marqueeBox).not.toBeNull();
  expect(mainBox).not.toBeNull();
  expect(marqueeBox!.x).toBeGreaterThanOrEqual(mainBox!.x - 1);
  expect(marqueeBox!.x + marqueeBox!.width).toBeLessThanOrEqual(mainBox!.x + mainBox!.width + 1);
}

async function startTouchDrag(page: Page, deltaX: number) {
  const marquee = page.getByTestId('featured-listings-marquee');
  const box = await marquee.boundingBox();
  expect(box).not.toBeNull();
  const client = await page.context().newCDPSession(page);
  const startX = box!.x + box!.width / 2;
  const y = box!.y + box!.height / 2;

  await client.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ id: 1, x: startX, y }],
  });
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ id: 1, x: startX + deltaX * 0.45, y }],
  });
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ id: 1, x: startX + deltaX, y }],
  });

  return client;
}

async function finishTouchDrag(client: { send: (...args: any[]) => Promise<any>; detach: () => Promise<void> }) {
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await client.detach();
}

async function prepareMarquee(page: Page) {
  await mockMarketplaceData(page);
  await page.goto('/');
  const marquee = page.getByTestId('featured-listings-marquee');
  await expect(marquee).toBeVisible();
  await marquee.scrollIntoViewIfNeeded();
  await expect(marquee.locator('[data-testid^="card-listing-"]').first()).toBeVisible();
  await expect
    .poll(() => transformX(page), { timeout: 5_000 })
    .not.toBe(0);
  await expectNoHorizontalPageScroll(page);
  await expectMarqueeContained(page);
}

test.describe('featured listings marquee touch dragging', () => {
  test.skip(
    missingConfiguration,
    'Set E2E_BASE_URL and create the seller storage state with pnpm setup:e2e-auth to run the marquee interaction regression.',
  );

  test.use({ storageState: sellerStorageState, hasTouch: true, isMobile: true });

  for (const width of [375, 390, 430]) {
    test(`supports right and left touch drags at ${width}px without moving the page`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await prepareMarquee(page);

      const beforeAutoMotion = await transformX(page);
      await expect
        .poll(() => transformX(page), { timeout: 5_000 })
        .not.toBe(beforeAutoMotion);

      for (const deltaX of [150, -150]) {
        const beforeDrag = await transformX(page);
        const client = await startTouchDrag(page, deltaX);
        await expect(page.getByTestId('featured-listings-marquee')).toHaveClass(/is-dragging/);
        await expect
          .poll(() => transformX(page), { timeout: 1_000 })
          .not.toBe(beforeDrag);

        const whileDragging = await transformX(page);
        await page.waitForTimeout(350);
        expect(await transformX(page)).toBe(whileDragging);
        await expectNoHorizontalPageScroll(page);
        await expectMarqueeContained(page);

        await finishTouchDrag(client);
        await expect(page.getByTestId('featured-listings-marquee')).not.toHaveClass(/is-dragging/);
        await expect
          .poll(() => transformX(page), { timeout: 5_000 })
          .not.toBe(whileDragging);
        await expectNoHorizontalPageScroll(page);
        await expectMarqueeContained(page);
      }
    });
  }
});

test.describe('featured listings marquee mouse dragging', () => {
  test.skip(
    missingConfiguration,
    'Set E2E_BASE_URL and create the seller storage state with pnpm setup:e2e-auth to run the marquee interaction regression.',
  );

  test.use({
    storageState: sellerStorageState,
    viewport: { width: 1280, height: 900 },
    hasTouch: false,
    isMobile: false,
  });

  test('supports mouse dragging without horizontal page scroll or autoplay during the drag', async ({ page }) => {
    await prepareMarquee(page);
    const marquee = page.getByTestId('featured-listings-marquee');
    const box = (await marquee.boundingBox())!;
    const startX = box.x + box.width / 2;
    const y = box.y + box.height / 2;

    const beforeDrag = await transformX(page);
    await page.mouse.move(startX, y);
    await page.mouse.down();
    await page.mouse.move(startX - 180, y, { steps: 4 });
    await expect(marquee).toHaveClass(/is-dragging/);
    await expect.poll(() => transformX(page), { timeout: 1_000 }).not.toBe(beforeDrag);

    const whileDragging = await transformX(page);
    await page.waitForTimeout(350);
    expect(await transformX(page)).toBe(whileDragging);
    await expectNoHorizontalPageScroll(page);
    await expectMarqueeContained(page);

    await page.mouse.up();
    await expect(marquee).not.toHaveClass(/is-dragging/);
    await expect
      .poll(() => transformX(page), { timeout: 5_000 })
      .not.toBe(whileDragging);
    await expectNoHorizontalPageScroll(page);
    await expectMarqueeContained(page);
  });
});
