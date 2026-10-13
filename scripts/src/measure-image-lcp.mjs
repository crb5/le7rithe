import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

const base = process.argv[3] || `https://${process.env.REPLIT_DEV_DOMAIN}`;
const browser = await chromium.launch({ executablePath: '/repl/tools/bin/chromium', headless: true, args: ['--no-sandbox'] });
const results = { environment: 'locally bundled app using development data, cold browser cache, 390x844, 4x CPU slowdown, 1.6Mbps down / 750Kbps up, 150ms latency', pages: {} };
try {
  // Warm Vite compilation without warming the measured browser contexts.
  const warm = await browser.newPage();
  await warm.goto(base, { waitUntil: 'networkidle' });
  await warm.goto(`${base}/listings/55`, { waitUntil: 'networkidle' });
  await warm.close();
  for (const path of ['/', '/listings/55']) {
    const runs = [];
    for (let i = 0; i < 3; i++) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 1 });
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page);
      await cdp.send('Network.enable');
      await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
      await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 200000, uploadThroughput: 93750 });
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      await page.addInitScript(() => {
        window.__lcp = null;
        window.__cls = 0;
        new PerformanceObserver(list => {
          const entry = list.getEntries().at(-1);
          window.__lcp = { ms: entry.startTime, element: entry.element?.tagName, image: entry.element?.getAttribute('src') ?? null };
        }).observe({ type: 'largest-contentful-paint', buffered: true });
        new PerformanceObserver(list => {
          for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__cls += entry.value;
        }).observe({ type: 'layout-shift', buffered: true });
      });
      await page.goto(`${base}${path}`, { waitUntil: 'load', timeout: 120000 });
      await page.waitForTimeout(12000);
      const data = await page.evaluate(() => ({ lcp: window.__lcp, cls: window.__cls }));
      if (!data.lcp) throw new Error(`No LCP was recorded for ${path}`);
      runs.push(data);
      console.log(path, i + 1, JSON.stringify(data));
      await context.close();
    }
    results.pages[path] = { runs, medianLcpMs: runs.map(r => r.lcp.ms).sort((a, b) => a - b)[1] };
  }
  await writeFile(process.argv[2], JSON.stringify(results, null, 2));
} finally {
  await browser.close();
}
