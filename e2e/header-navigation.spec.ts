import { expect, test } from '@playwright/test';

const baseURL =
  process.env.E2E_BASE_URL ??
  (process.env.REPLIT_DEV_DOMAIN
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : undefined);

test.describe('shared marketplace header', () => {
  test.skip(!baseURL, 'Set E2E_BASE_URL to run the marketplace header regression.');

  test('keeps controls aligned and contained from narrow phones to desktop', async ({ page }) => {
    await page.goto('/');
    await page.addStyleTag({
      content: '#replit-dev-banner, #replit-dev-banner * { pointer-events: none !important; }',
    });

    const header = page.getByTestId('marketplace-header');
    const siteHeader = page.getByTestId('site-header');
    const languageButton = page.getByTestId('select-language');
    await expect(page.getByTestId('link-footer-brand')).toHaveText('Le7rithe.com');
    await expect(header).toHaveAttribute('data-header-state', 'visible');
    await expect(languageButton).toHaveAttribute('data-language', 'ar');
    await expect(languageButton).toHaveAttribute('aria-label', 'Language: العربية (AR)');
    await expect(languageButton).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByTestId('language-flag-ar')).toHaveAttribute('data-language-flag', 'ar');
    expect(await languageButton.evaluate((element) => element.getBoundingClientRect().height))
      .toBeGreaterThanOrEqual(40);
    const initialCodeBox = await page.getByTestId('language-code').boundingBox();
    const initialFlagBox = await page.getByTestId('language-flag-ar').boundingBox();
    expect(initialCodeBox).not.toBeNull();
    expect(initialFlagBox).not.toBeNull();
    expect(initialCodeBox!.x + initialCodeBox!.width).toBeLessThan(initialFlagBox!.x);
    await expect(page.getByTestId('link-header-notifications')).toHaveCount(0);
    await expect(page.getByTestId('link-header-nav-notifications')).toHaveCount(0);
    await expect(page.getByTestId('link-nav-notifications')).toHaveCount(1);

    for (const viewport of [
      { width: 320, height: 740 },
      { width: 390, height: 844 },
      { width: 768, height: 1024 },
      { width: 1280, height: 900 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      await expect(header).toBeVisible();
      await expect(languageButton).toBeVisible();
      await expect(page.getByTestId('link-header-notifications')).toHaveCount(0);

      const menuButton = page.getByTestId('button-open-menu');
      const logo = page.getByTestId('link-header-brand');
      await expect(menuButton).toBeVisible();
      await expect(menuButton).toHaveAttribute('aria-expanded', 'false');
      await expect(logo).toBeVisible();
      await expect(page.getByTestId('link-header-add')).toHaveCount(0);
      await expect(page.getByTestId('link-header-nav-discover')).toHaveCount(0);

      const controls = [menuButton, languageButton, logo];
      const boxes = await Promise.all(controls.map((control) => control.boundingBox()));
      expect(boxes.every((box) => box !== null)).toBe(true);
      const visibleBoxes = boxes.filter((box): box is NonNullable<typeof box> => box !== null);
      const centers = visibleBoxes.map((box) => box.y + box.height / 2);
      expect(Math.max(...centers) - Math.min(...centers)).toBeLessThanOrEqual(1);

      const sortedBoxes = [...visibleBoxes].sort((left, right) => left.x - right.x);
      for (let index = 1; index < sortedBoxes.length; index += 1) {
        expect(sortedBoxes[index - 1].x + sortedBoxes[index - 1].width)
          .toBeLessThanOrEqual(sortedBoxes[index].x + 1);
      }

      const widths = await siteHeader.evaluate((element) => ({
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
      }));
      expect(widths.scrollWidth).toBeLessThanOrEqual(widths.clientWidth + 1);
      expect(await page.locator('html').evaluate((element) => element.scrollWidth))
        .toBeLessThanOrEqual(viewport.width);
    }

    await page.setViewportSize({ width: 320, height: 740 });
    await languageButton.click();
    for (const [language, code, label] of [
      ['ar', 'AR', 'العربية'],
      ['fr', 'FR', 'Français'],
      ['en', 'EN', 'English'],
    ] as const) {
      const option = page.getByTestId(`language-option-${language}`);
      await expect(option).toHaveAttribute('role', 'option');
      await expect(option).toHaveAttribute('aria-label', `${label} (${code})`);
      await expect(option).toHaveText(code);
      await expect(option).toHaveAttribute('aria-selected', language === 'ar' ? 'true' : 'false');
      await expect(page.getByTestId(`language-option-flag-${language}`))
        .toHaveAttribute('data-language-flag', language);
      expect(await option.evaluate((element) => element.getBoundingClientRect().height))
        .toBeGreaterThanOrEqual(40);
    }
    await page.getByTestId('language-option-fr').click();
    await expect(languageButton).toHaveAttribute('data-language', 'fr');
    await expect(languageButton).toHaveAttribute('aria-label', 'Language: Français (FR)');
    await expect(languageButton).toHaveAttribute('aria-expanded', 'false');
    await expect(languageButton.locator('[data-language-flag="fr"]')).toBeVisible();
    await expect(siteHeader).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('html').evaluate((element) => element.scrollWidth)).resolves.toBeLessThanOrEqual(320);

    await languageButton.click();
    await expect(page.getByTestId('language-option-fr')).toHaveAttribute('aria-selected', 'true');
    await page.mouse.click(300, 80);
    await expect(page.getByTestId('language-option-fr')).toBeHidden();
    await expect(languageButton).toHaveAttribute('aria-expanded', 'false');

    await languageButton.click();
    await page.getByTestId('language-option-en').click();
    await expect(languageButton).toHaveAttribute('data-language', 'en');
    await expect(languageButton).toHaveAttribute('aria-label', 'Language: English (EN)');
    await expect(languageButton.locator('[data-language-flag="en"]')).toBeVisible();
    await expect(siteHeader).toHaveAttribute('dir', 'ltr');

    await languageButton.click();
    await page.getByTestId('language-option-ar').click();
    await expect(languageButton).toHaveAttribute('data-language', 'ar');
    await expect(languageButton.locator('[data-language-flag="ar"]')).toBeVisible();
    await expect(siteHeader).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

    await languageButton.click();
    await expect(page.getByTestId('language-option-ar')).toBeVisible();
    await page.evaluate(() => {
      (document.activeElement as HTMLElement | null)?.blur();
    });
    await page.mouse.move(300, 500);
    await page.mouse.wheel(0, 120);
    await expect(header).toHaveAttribute('data-header-state', 'visible');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('language-option-ar')).toBeHidden();
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(header).toHaveAttribute('data-header-state', 'visible');

    const menuButton = page.getByTestId('button-open-menu');
    await menuButton.click();
    const drawer = page.locator('#marketplace-navigation-drawer');
    await expect(page.getByTestId('button-close-menu')).toBeFocused();
    const sidebarNotifications = page.getByTestId('link-nav-notifications');
    await expect(sidebarNotifications).toBeVisible();
    await expect(sidebarNotifications).toHaveAttribute('href', '/notifications');
    const sidebarBrand = page.getByTestId('link-sidebar-brand');
    await expect(sidebarBrand).toBeVisible();
    await expect(sidebarBrand).toHaveAttribute('aria-label', 'Le7rithe.com');
    await expect(sidebarBrand).toHaveAttribute('href', '/');
    await expect(sidebarBrand.locator('.sh-word')).toHaveText('Le7rithe.com');
    await expect(sidebarBrand.locator('.sh-tagline')).toHaveCount(0);
    await expect(sidebarBrand.locator('.sh-mark')).toHaveCount(1);
    await page.mouse.move(300, 500);
    await page.mouse.wheel(0, 120);
    await expect(header).toHaveAttribute('data-header-state', 'visible');
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.keyboard.press('Escape');
    await expect(drawer).toHaveAttribute('aria-hidden', 'true');
    await expect(menuButton).toBeFocused();
  });

  test('orders the header and opens navigation from the correct side for each language', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/');
    await page.addStyleTag({
      content: '#replit-dev-banner, #replit-dev-banner * { pointer-events: none !important; }',
    });

    const siteHeader = page.getByTestId('site-header');
    const languageButton = page.getByTestId('select-language');
    const menuButton = page.getByTestId('button-open-menu');
    const drawer = page.locator('#marketplace-navigation-drawer');

    for (const viewport of [
      { width: 390, height: 844 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));

      for (const locale of ['ar', 'fr', 'en'] as const) {
        const currentLocale = await languageButton.getAttribute('data-language');
        if (currentLocale !== locale) {
          const directionChanges =
            (currentLocale === 'ar') !== (locale === 'ar');
          await languageButton.click();
          await page.getByTestId(`language-option-${locale}`).click();
          await expect(languageButton).toHaveAttribute('data-language', locale);
          if (directionChanges) {
            const localeAnimations = await siteHeader.evaluate(
              (element) => element.getAnimations({ subtree: true }).length,
            );
            expect(localeAnimations).toBeGreaterThan(0);
          }
          await siteHeader.evaluate(async (element) => {
            await Promise.all(
              element.getAnimations({ subtree: true }).map((animation) =>
                animation.finished.catch(() => undefined),
              ),
            );
          });
        }

        const direction = locale === 'ar' ? 'rtl' : 'ltr';
        await expect(siteHeader).toHaveAttribute('dir', 'ltr');
        await expect(page.locator('.grain')).toHaveAttribute('dir', direction);
        await expect(page.getByTestId('link-header-brand')).toHaveAttribute('dir', direction);
        await expect(page.getByTestId('link-header-brand').locator('.sh-word'))
          .toHaveAttribute('dir', 'ltr');

        const flexDirection = await siteHeader.evaluate((element) => getComputedStyle(element).flexDirection);
        expect(flexDirection).toBe(locale === 'ar' ? 'row' : 'row-reverse');

        const identityBox = await page.getByTestId('header-identity').boundingBox();
        const toolsBox = await page.getByTestId('header-tools').boundingBox();
        const languageBox = await languageButton.boundingBox();
        const menuBox = await menuButton.boundingBox();
        expect(identityBox).not.toBeNull();
        expect(toolsBox).not.toBeNull();
        expect(languageBox).not.toBeNull();
        expect(menuBox).not.toBeNull();
        if (locale === 'ar') {
          expect(identityBox!.x + identityBox!.width).toBeLessThanOrEqual(toolsBox!.x + 1);
          expect(languageBox!.x + languageBox!.width).toBeLessThanOrEqual(menuBox!.x + 1);
        } else {
          expect(toolsBox!.x + toolsBox!.width).toBeLessThanOrEqual(identityBox!.x + 1);
          expect(menuBox!.x + menuBox!.width).toBeLessThanOrEqual(languageBox!.x + 1);
        }

        await languageButton.click();
        const languageList = page.getByRole('listbox');
        const languageListBox = await languageList.boundingBox();
        const openLanguageBox = await languageButton.boundingBox();
        expect(languageListBox).not.toBeNull();
        expect(openLanguageBox).not.toBeNull();
        await expect(languageList).toHaveAttribute('dir', direction);
        if (locale === 'ar') {
          expect(
            Math.abs(
              languageListBox!.x + languageListBox!.width -
                (openLanguageBox!.x + openLanguageBox!.width),
            ),
          ).toBeLessThanOrEqual(1);
        } else {
          expect(Math.abs(languageListBox!.x - openLanguageBox!.x)).toBeLessThanOrEqual(1);
        }
        expect(languageListBox!.x).toBeGreaterThanOrEqual(0);
        expect(languageListBox!.x + languageListBox!.width).toBeLessThanOrEqual(viewport.width);
        await page.keyboard.press('Escape');
        await expect(languageList).toBeHidden();
        await expect(languageButton).toHaveAttribute('aria-expanded', 'false');

        await menuButton.click();
        await expect(drawer).toHaveAttribute('aria-hidden', 'false');
        await expect(drawer).toHaveAttribute('dir', direction);
        await drawer.evaluate(async (element) => {
          await Promise.all(
            element.getAnimations().map((animation) => animation.finished.catch(() => undefined)),
          );
        });
        const drawerBox = await drawer.boundingBox();
        expect(drawerBox).not.toBeNull();
        if (locale === 'ar') {
          expect(Math.abs(drawerBox!.x + drawerBox!.width - viewport.width)).toBeLessThanOrEqual(1);
        } else {
          expect(Math.abs(drawerBox!.x)).toBeLessThanOrEqual(1);
        }
        await page.keyboard.press('Escape');
        await expect(drawer).toHaveAttribute('aria-hidden', 'true');
        await expect(menuButton).toBeFocused();
      }
    }
  });

  test('hides on scroll down, reveals on a short scroll up, and stays visible at the top', async ({ page }) => {
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto('/');

      const header = page.getByTestId('marketplace-header');
      const siteHeader = page.getByTestId('site-header');
      const initialLayout = await header.evaluate((element) => {
        const shell = document.querySelector<HTMLElement>('.market-content-shell');
        const style = getComputedStyle(element);
        return {
          position: style.position,
          headerTop: element.getBoundingClientRect().top,
          headerHeight: element.getBoundingClientRect().height,
          contentPaddingTop: shell ? Number.parseFloat(getComputedStyle(shell).paddingTop) : 0,
          transitionDuration: style.transitionDuration,
          transitionTimingFunction: style.transitionTimingFunction,
        };
      });
      expect(initialLayout.position).toBe('fixed');
      expect(initialLayout.headerTop).toBe(0);
      expect(initialLayout.contentPaddingTop).toBeCloseTo(initialLayout.headerHeight, 0);
      expect(initialLayout.transitionDuration).toBe('0.35s');
      expect(initialLayout.transitionTimingFunction).toBe('cubic-bezier(0.4, 0, 0.2, 1)');

      const initialMainTop = await page.locator('main').evaluate((element) => (element as HTMLElement).offsetTop);
      await page.mouse.move(Math.min(300, viewport.width - 10), 400);
      await page.mouse.wheel(0, 100);
      await expect(header).toHaveAttribute('data-header-state', 'hidden');

      const hiddenMainTop = await page.locator('main').evaluate((element) => (element as HTMLElement).offsetTop);
      expect(hiddenMainTop).toBe(initialMainTop);

      await page.mouse.wheel(0, -7);
      await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
      await expect(header).toHaveAttribute('data-header-state', 'hidden');

      await page.mouse.wheel(0, -1);
      await expect(header).toHaveAttribute('data-header-state', 'visible');
      await expect(header).toHaveAttribute('data-header-elevated', 'true');
      await expect.poll(() => siteHeader.evaluate((element) => getComputedStyle(element).backdropFilter))
        .toBe('blur(8px)');

      await page.evaluate(() => window.scrollTo(0, 5));
      await expect(header).toHaveAttribute('data-header-state', 'visible');
      await expect(header).toHaveAttribute('data-header-elevated', 'false');
      await page.evaluate(() => window.scrollTo(0, 13));
      await expect(header).toHaveAttribute('data-header-state', 'hidden');
      await page.evaluate(() => window.scrollTo(0, 9));
      await expect(header).toHaveAttribute('data-header-state', 'visible');
      await page.evaluate(() => window.scrollTo(0, 18));
      await expect(header).toHaveAttribute('data-header-state', 'hidden');
      await page.evaluate(() => window.scrollTo(0, 0));
      await expect(header).toHaveAttribute('data-header-state', 'visible');
    }

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect.poll(() =>
      page.getByTestId('marketplace-header').evaluate((element) => getComputedStyle(element).transitionDuration),
    ).toBe('0s');
  });
});