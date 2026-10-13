import { expect, test, type Locator, type Page } from '@playwright/test';

const fixtureId = 94000;
const viewport = { width: 390, height: 844 };
const cases = [1, 3, 5, 8] as const;
const languages = [
  { code: 'ar', direction: 'rtl' },
  { code: 'fr', direction: 'ltr' },
  { code: 'en', direction: 'ltr' },
] as const;

function fixtureListing(count: number) {
  const images = Array.from({ length: count }, (_, index) => `/e2e-gallery-${index}.svg`);
  return {
    id: fixtureId,
    title: 'Mobile gallery test listing',
    category: 'Agricultural machinery',
    categorySlug: 'tractors',
    subcategory: null,
    subcategorySlug: null,
    price: 125000,
    currency: 'MRU',
    location: 'Nouakchott',
    condition: 'used',
    year: 2022,
    manufacturer: null,
    model: null,
    hours: null,
    area: null,
    waterAvailable: null,
    electricityAvailable: null,
    ownershipType: null,
    contactPhone: null,
    attributes: {},
    description: 'Temporary browser fixture for checking the responsive listing gallery.',
    imageUrl: images[0],
    images,
    seller: {
      id: 1,
      name: 'Gallery test',
      initials: 'GT',
      verified: true,
      phone: null,
    },
    createdAt: '2025-01-01T12:00:00.000Z',
    expiresAt: null,
    featured: false,
    isSaved: false,
  };
}

async function mockGallery(page: Page, count: number) {
  await page.route(`**/api/listings/${fixtureId}`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', json: fixtureListing(count) }),
  );
  await page.route('**/e2e-gallery-*.svg', (route) => {
    const imageIndex = Number(route.request().url().match(/e2e-gallery-(\d+)\.svg/)?.[1] ?? 0);
    const portrait = imageIndex % 2 === 0;
    const width = portrait ? 240 : 640;
    const height = portrait ? 400 : 360;
    return route.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      body: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="${portrait ? '#477ca5' : '#c28d3d'}"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="white" font-size="28">${portrait ? 'Portrait' : 'Landscape'} ${imageIndex + 1}</text></svg>`,
    });
  });
}

async function chooseLanguage(page: Page, language: 'ar' | 'fr' | 'en') {
  const devBannerCloseButton = page.locator('#replit-dev-banner button').first();
  if (await devBannerCloseButton.count()) await devBannerCloseButton.click({ force: true });
  if (language === 'ar') return;
  await page.getByTestId('select-language').click();
  await page.getByTestId(`language-option-${language}`).click();
  await expect(page.locator('html')).toHaveAttribute('lang', language);
}

async function dispatchTouchGesture(page: Page, target: Locator, deltaX: number, deltaY: number) {
  const box = await target.boundingBox();
  expect(box).not.toBeNull();
  const session = await page.context().newCDPSession(page);
  const startX = box!.x + box!.width / 2;
  const startY = box!.y + box!.height / 2;
  try {
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ id: 1, x: startX, y: startY }],
    });
    for (const fraction of [0.25, 0.5, 0.75, 1]) {
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ id: 1, x: startX + deltaX * fraction, y: startY + deltaY * fraction }],
      });
      await page.waitForTimeout(20);
    }
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } finally {
    await session.detach();
  }
}

for (const count of cases) {
  for (const language of languages) {
    test(`${count} portrait/landscape images at 390px in ${language.code}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.addInitScript(() => {
        const target = window as typeof window & { __listingGalleryCLS?: number };
        target.__listingGalleryCLS = 0;
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries() as Array<PerformanceEntry & { value: number; hadRecentInput: boolean }>;
          for (const entry of entries) {
            if (!entry.hadRecentInput) target.__listingGalleryCLS! += entry.value;
          }
        });
        observer.observe({ type: 'layout-shift', buffered: true } as PerformanceObserverInit);
      });
      await mockGallery(page, count);
      await page.goto(`/listings/${fixtureId}`);
      await expect(page.getByTestId('img-detail-main')).toBeVisible();
      await chooseLanguage(page, language.code);
      await expect(page.locator('html')).toHaveAttribute('dir', language.direction);

      const mainImage = page.getByTestId('img-detail-main');
      await expect.poll(() => mainImage.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(250);
      await page.evaluate(() => {
        (window as typeof window & { __listingGalleryCLS?: number }).__listingGalleryCLS = 0;
      });

      const measurements = await page.evaluate(() => {
        const image = document.querySelector<HTMLImageElement>('[data-testid="img-detail-main"]')!;
        const galleryFrame = image.closest('.rounded-3xl') as HTMLElement;
        const detailsGrid = Array.from(document.querySelectorAll<HTMLElement>('.grain *'))
          .find((element) => element.classList.contains('gap-8') && element.contains(image))!;
        const detailContent = detailsGrid.firstElementChild as HTMLElement;
        const thumbnailStrip = document.querySelector<HTMLElement>('[data-testid="listing-thumbnail-strip"]');
        const galleryAspectFrame = image.parentElement?.parentElement as HTMLElement;
        const rect = (element: HTMLElement) => {
          const box = element.getBoundingClientRect();
          return {
            left: box.left,
            right: box.right,
            width: box.width,
          height: box.height,
            clientWidth: element.clientWidth,
            scrollWidth: element.scrollWidth,
            overflowX: getComputedStyle(element).overflowX,
          };
        };
        return {
          viewportWidth: innerWidth,
          documentWidth: document.documentElement.scrollWidth,
          bodyWidth: document.body.scrollWidth,
          bodyOverflowX: getComputedStyle(document.body).overflowX,
          scrollX,
          detailGrid: rect(detailsGrid),
          detailContent: rect(detailContent),
          galleryFrame: rect(galleryFrame),
          galleryAspectFrame: rect(galleryAspectFrame),
          thumbnailStrip: thumbnailStrip ? rect(thumbnailStrip) : null,
          thumbnailFlexShrink: thumbnailStrip
            ? Array.from(thumbnailStrip.querySelectorAll<HTMLElement>('[data-testid^="button-gallery-"]'))
              .map((button) => getComputedStyle(button).flexShrink)
            : [],
          image: {
            ...rect(image),
            objectFit: getComputedStyle(image).objectFit,
            maxWidth: getComputedStyle(image).maxWidth,
          },
        };
      });

      if (count === 8 && language.code === 'ar') {
        console.log(`8-image RTL layout check: ${JSON.stringify(measurements)}`);
      }
      expect(measurements.documentWidth).toBeLessThanOrEqual(viewport.width);
      expect(measurements.bodyWidth).toBeLessThanOrEqual(viewport.width);
      expect(measurements.bodyOverflowX).toBe('visible');
      expect(measurements.scrollX).toBe(0);
      expect(measurements.detailGrid.scrollWidth).toBeLessThanOrEqual(viewport.width);
      expect(measurements.detailContent.width).toBeLessThanOrEqual(viewport.width);
      expect(measurements.detailGrid.right).toBeLessThanOrEqual(viewport.width + 0.5);
      expect(measurements.galleryFrame.right).toBeLessThanOrEqual(viewport.width + 0.5);
      expect(measurements.image.objectFit).toBe('contain');
      expect(measurements.image.maxWidth).toBe('100%');
      expect(measurements.galleryFrame.overflowX).toBe('hidden');
      expect(measurements.galleryAspectFrame.width / measurements.galleryAspectFrame.height).toBeCloseTo(1.65, 1);

      const thumbnails = page.locator('[data-testid^="button-gallery-"]');
      if (count === 1) {
        await expect(thumbnails).toHaveCount(0);
      } else {
        await expect(thumbnails).toHaveCount(count);
        const strip = page.locator('[data-testid="listing-thumbnail-strip"]');
        await expect(strip).toHaveCSS('overflow-x', 'auto');
        const stripDimensions = await strip.evaluate((element) => ({
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth,
        }));
        if (count >= 5) expect(stripDimensions.scrollWidth).toBeGreaterThan(stripDimensions.clientWidth);
        expect(measurements.thumbnailFlexShrink).toEqual(Array(count).fill('0'));
      }

      await page.waitForTimeout(250);
      const cls = await page.evaluate(() =>
        (window as typeof window & { __listingGalleryCLS?: number }).__listingGalleryCLS ?? 0,
      );
      if (count === 8) console.log(`8-image ${language.code} CLS: ${cls}`);
      expect(cls).toBeLessThan(0.01);

      if (count >= 3) {
        await thumbnails.nth(1).click();
        const lightbox = page.getByTestId('listing-image-lightbox');
        await expect(lightbox).toContainText(`2 / ${count}`);
        const lightboxImage = page.getByTestId('img-lightbox-active');
        await expect(lightboxImage).toHaveAttribute('src', '/e2e-gallery-1.svg');
        await expect(lightboxImage).toHaveCSS('object-fit', 'contain');
        await page.keyboard.press('ArrowLeft');
        await expect(lightbox).toContainText(`1 / ${count}`);
        await expect(page.getByTestId('img-lightbox-active')).toHaveAttribute('src', '/e2e-gallery-0.svg');
        await page.keyboard.press('ArrowRight');
        await expect(lightbox).toContainText(`2 / ${count}`);
        await expect(page.getByTestId('img-lightbox-active')).toHaveAttribute('src', '/e2e-gallery-1.svg');
        await page.getByTestId('button-close-image-lightbox').click();
        await expect(mainImage).toHaveAttribute('src', '/e2e-gallery-1.svg');
        const landscapeDimensions = await mainImage.evaluate((image) => ({
          width: (image as HTMLImageElement).naturalWidth,
          height: (image as HTMLImageElement).naturalHeight,
        }));
        expect(landscapeDimensions.width).toBeGreaterThan(landscapeDimensions.height);

        const selectedIndex = count - 1;
        await thumbnails.nth(selectedIndex).click();
        await expect(lightbox).toContainText(`${count} / ${count}`);
        await expect(page.getByTestId('img-lightbox-active')).toHaveAttribute(
          'src',
          `/e2e-gallery-${selectedIndex}.svg`,
        );
        await page.getByTestId('button-lightbox-previous').click();
        await expect(lightbox).toContainText(`${count - 1} / ${count}`);
        await expect(page.getByTestId('img-lightbox-active')).toHaveAttribute(
          'src',
          `/e2e-gallery-${selectedIndex - 1}.svg`,
        );
        await expect(thumbnails.nth(selectedIndex - 1)).toHaveAttribute('aria-pressed', 'true');
        await expect(thumbnails.nth(selectedIndex)).toHaveAttribute('aria-pressed', 'false');
        await page.getByTestId('button-lightbox-next').click();
        await expect(lightbox).toContainText(`${count} / ${count}`);
        await expect(page.getByTestId('img-lightbox-active')).toHaveAttribute(
          'src',
          `/e2e-gallery-${selectedIndex}.svg`,
        );
        await page.getByTestId('button-close-image-lightbox').click();
        await expect(mainImage).toHaveAttribute('src', `/e2e-gallery-${selectedIndex}.svg`);
        await expect(thumbnails.nth(selectedIndex)).toHaveAttribute('aria-pressed', 'true');
        await expect(thumbnails.nth(0)).toHaveAttribute('aria-pressed', 'false');
      }

      const finalWidths = await page.evaluate(() => ({
        body: document.body.scrollWidth,
        document: document.documentElement.scrollWidth,
        viewport: innerWidth,
        scrollX,
      }));
      expect(finalWidths.body).toBeLessThanOrEqual(viewport.width);
      expect(finalWidths.document).toBeLessThanOrEqual(viewport.width);
      expect(finalWidths.scrollX).toBe(0);
    });
  }
}

test.describe('main listing photo touch gestures', () => {
  test.use({ hasTouch: true, isMobile: true });

  for (const phoneViewport of [
    { width: 320, height: 740, language: 'fr' as const },
    { width: 390, height: 844, language: 'ar' as const },
    { width: 430, height: 932, language: 'en' as const },
  ]) {
    test(`navigates by horizontal swipe and preserves vertical page scroll at ${phoneViewport.width}px in ${phoneViewport.language}`, async ({ page }) => {
      await page.setViewportSize(phoneViewport);
      await mockGallery(page, 5);
      await page.goto(`/listings/${fixtureId}`);
      await chooseLanguage(page, phoneViewport.language);

      const mainImage = page.getByTestId('img-detail-main');
      const mainButton = page.getByTestId('button-open-main-image');
      const thumbnails = page.locator('[data-testid^="button-gallery-"]');
      await expect(mainButton).toHaveCSS('touch-action', 'pan-y pinch-zoom');
      await expect(mainImage).toHaveAttribute('src', '/e2e-gallery-0.svg');
      await expect(thumbnails.nth(0)).toHaveAttribute('aria-pressed', 'true');

      const nextSwipeDeltaX = phoneViewport.language === 'ar' ? 110 : -110;
      const previousSwipeDeltaX = -nextSwipeDeltaX;
      await dispatchTouchGesture(page, mainButton, previousSwipeDeltaX, 0);
      await expect(mainImage).toHaveAttribute('src', '/e2e-gallery-0.svg');

      await dispatchTouchGesture(page, mainButton, nextSwipeDeltaX, 0);
      await expect(mainImage).toHaveAttribute('src', '/e2e-gallery-1.svg');
      await expect(thumbnails.nth(1)).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByTestId('listing-image-lightbox')).toHaveCount(0);

      await dispatchTouchGesture(page, mainButton, previousSwipeDeltaX, 0);
      await expect(mainImage).toHaveAttribute('src', '/e2e-gallery-0.svg');
      await expect(thumbnails.nth(0)).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByTestId('listing-image-lightbox')).toHaveCount(0);

      for (let index = 1; index < 5; index += 1) {
        await dispatchTouchGesture(page, mainButton, nextSwipeDeltaX, 0);
        await expect(mainImage).toHaveAttribute('src', `/e2e-gallery-${index}.svg`);
        await expect(thumbnails.nth(index)).toHaveAttribute('aria-pressed', 'true');
      }
      const activeThumbnail = thumbnails.nth(4);
      await expect.poll(async () => {
        const [stripBox, thumbnailBox] = await Promise.all([
          page.getByTestId('listing-thumbnail-strip').boundingBox(),
          activeThumbnail.boundingBox(),
        ]);
        return Boolean(stripBox && thumbnailBox
          && thumbnailBox.x >= stripBox.x
          && thumbnailBox.x + thumbnailBox.width <= stripBox.x + stripBox.width);
      }).toBe(true);
      await dispatchTouchGesture(page, mainButton, previousSwipeDeltaX, 0);
      await expect(mainImage).toHaveAttribute('src', '/e2e-gallery-3.svg');
      await expect(thumbnails.nth(3)).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByTestId('listing-image-lightbox')).toHaveCount(0);

      const scrollBefore = await page.evaluate(() => window.scrollY);
      await dispatchTouchGesture(page, mainButton, 0, -140);
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(scrollBefore);
      await expect(mainImage).toHaveAttribute('src', '/e2e-gallery-3.svg');
      await expect(thumbnails.nth(3)).toHaveAttribute('aria-pressed', 'true');
    });
  }

  test('a single image stays unchanged and does not open the lightbox on swipe', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockGallery(page, 1);
    await page.goto(`/listings/${fixtureId}`);

    const mainImage = page.getByTestId('img-detail-main');
    await expect(mainImage).toHaveAttribute('src', '/e2e-gallery-0.svg');
    await expect(page.getByTestId('listing-thumbnail-strip')).toHaveCount(0);
    await dispatchTouchGesture(page, page.getByTestId('button-open-main-image'), -110, 0);
    await expect(mainImage).toHaveAttribute('src', '/e2e-gallery-0.svg');
    await expect(page.getByTestId('listing-image-lightbox')).toHaveCount(0);
  });
});
