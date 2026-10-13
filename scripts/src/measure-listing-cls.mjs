// Read-only, cold-browser measurements against an existing marketplace listing.
import lighthouse from 'lighthouse';
import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

const url = process.argv[3] || 'http://127.0.0.1:19062/listings/55';
const browserOptions = { executablePath: '/repl/tools/bin/chromium', headless: true,
  args: ['--no-sandbox', '--remote-debugging-port=9223'] };
const runs = [];
for (let i = 0; i < 3; i++) {
  const browser = await chromium.launch(browserOptions);
  try {
    const result = await lighthouse(url, {
      port: 9223, logLevel: 'error', onlyCategories: ['performance'],
      throttlingMethod: 'devtools', formFactor: 'mobile',
      screenEmulation: { mobile: true, width: 390, height: 844, deviceScaleFactor: 1, disabled: false },
      throttling: { rttMs: 150, throughputKbps: 1600, requestLatencyMs: 150,
        downloadThroughputKbps: 1600, uploadThroughputKbps: 750, cpuSlowdownMultiplier: 4 },
      disableFullPageScreenshot: true,
    });
    if (result.lhr.runtimeError) throw new Error(result.lhr.runtimeError.message);
    const audits = result.lhr.audits;
    runs.push({ cls: audits['cumulative-layout-shift'].numericValue,
      lcpMs: audits['largest-contentful-paint'].numericValue,
      culprits: audits['cls-culprits-insight']?.details ?? audits['layout-shift-elements']?.details });
    console.log('Lighthouse', i + 1, runs.at(-1).cls);
  } finally { await browser.close(); }
}
const traces = [];
for (const width of [390, 1440]) {
  const browser = await chromium.launch(browserOptions);
  try {
    const page = await browser.newPage({ viewport: { width, height: 844 }, deviceScaleFactor: 1 });
    await page.addInitScript(() => {
      window.__shifts = [];
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          if (entry.hadRecentInput) continue;
          window.__shifts.push({ time: entry.startTime, value: entry.value,
            sources: entry.sources.map(source => ({
              node: source.node?.getAttribute?.('data-testid') || source.node?.tagName,
              className: typeof source.node?.className === 'string' ? source.node.className : '',
              before: source.previousRect.toJSON(), after: source.currentRect.toJSON(),
            })) });
        }
      }).observe({ type: 'layout-shift', buffered: true });
    });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150,
      downloadThroughput: 1600 * 1024 / 8, uploadThroughput: 750 * 1024 / 8 });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(12000);
    const shifts = await page.evaluate(() => window.__shifts);
    let max = 0, session = 0, start = 0, previous = 0;
    for (const shift of shifts) {
      if (shift.time - previous > 1000 || shift.time - start > 5000) {
        session = 0; start = shift.time;
      }
      session += shift.value; previous = shift.time; max = Math.max(max, session);
    }
    traces.push({ width, cls: max, shifts });
    console.log('Observer', width, max, JSON.stringify(shifts));
  } finally { await browser.close(); }
}
await writeFile(process.argv[2], JSON.stringify({
  method: 'Local bundled app, real listing; cold browsers; Lighthouse mobile 390x844 DPR1 CPU4x 1.6Mbps/750Kbps/150ms; separate observer at mobile/desktop, no interactions',
  runs, medianCls: runs.map(r => r.cls).sort((a, b) => a - b)[1], traces,
}, null, 2));
