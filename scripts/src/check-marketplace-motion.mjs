import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ executablePath: '/repl/tools/bin/chromium', headless: true, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  await page.addInitScript(() => {
    window.shifts = [];
    new PerformanceObserver(list => list.getEntries().forEach(e => {
      if (!e.hadRecentInput) window.shifts.push({ value: e.value, nodes: e.sources.map(s => ({
        tag: s.node?.tagName, testId: s.node?.getAttribute?.('data-testid'), class: s.node?.className,
        before: s.previousRect.toJSON(), after: s.currentRect.toJSON(),
      })) });
    })).observe({ type: 'layout-shift', buffered: true });
  });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1600 * 1024 / 8, uploadThroughput: 750 * 1024 / 8 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.goto('http://127.0.0.1:19062/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(12000);
  console.log('startup', JSON.stringify(await page.evaluate(() => ({
    shifts: window.shifts, headline: document.querySelector('h1').getBoundingClientRect().toJSON(),
    font: getComputedStyle(document.querySelector('h1')).font,
    cards: [...document.querySelectorAll('.listing-card')].length,
  }))));
  assert.equal(await page.locator('h1').evaluate(e => e.getAnimations().length), 0);
  await page.evaluate(() => { window.motionEvents = []; document.addEventListener('animationstart', e => {
    if (e.animationName === 'card-enter') window.motionEvents.push(e.target.getAttribute('data-testid'));
  }); });
  const card = page.locator('.listing-card').first();
  if (await card.count()) {
    await card.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    const first = await page.evaluate(() => window.motionEvents.length);
    assert.equal(first, 1);
    await page.evaluate(() => scrollTo(0, 0));
    await page.waitForTimeout(250);
    await card.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    assert.equal(await page.evaluate(() => window.motionEvents.length), first);
    await card.hover();
    await page.waitForTimeout(250);
    assert.equal(await card.evaluate(e => new DOMMatrix(getComputedStyle(e).transform).m42), -3);
    await page.mouse.move(0, 0);
    // Isolated visual-state assertion only: no favorite/API write or sign-in.
    const save = card.locator('[aria-pressed]').first();
    await save.evaluate(e => e.setAttribute('aria-pressed', 'true'));
    await page.waitForTimeout(30);
    assert.ok(await save.locator('svg').evaluate(e => e.classList.contains('motion-save')));
    await page.waitForTimeout(300);
    await save.evaluate(e => e.setAttribute('aria-pressed', 'false'));
  }
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(300);
  for (const language of ['ar', 'fr']) {
    if (language === 'fr') {
      await page.getByTestId('select-language').click();
      await page.getByTestId('language-option-fr').click();
    }
    await page.getByTestId('button-open-menu').click();
    await page.waitForTimeout(300);
    const drawer = page.locator('#marketplace-navigation-drawer');
    assert.equal(await drawer.evaluate(e => new DOMMatrix(getComputedStyle(e).transform).m41), 0);
    await page.getByTestId('button-close-menu').click();
    await page.waitForTimeout(300);
    assert.ok(await drawer.evaluate((e, language) => {
      const x = new DOMMatrix(getComputedStyle(e).transform).m41;
      return language === 'ar' ? x > 0 : x < 0;
    }, language));
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await card.hover();
  await page.waitForTimeout(300);
  assert.equal(await card.evaluate(e => getComputedStyle(e).transform), 'none');
  assert.equal(await page.evaluate(() => document.getAnimations().filter(a => a.playState === 'running').length), 0);
  await page.goto('http://127.0.0.1:19062/listings/55');
  await page.getByTestId('button-report-listing').click();
  assert.equal(await page.locator('.motion-dialog').evaluate(e => e.getAnimations().length), 0);
  console.log('PASS: first-screen exclusion, once-only card reveal, hover, save pulse visual state, RTL/LTR drawer, reduced-motion including modal');
} finally { await browser.close(); }
