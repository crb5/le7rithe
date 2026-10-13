import lighthouse from 'lighthouse';
import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { readdir, stat } from 'node:fs/promises';

const base = process.argv[3] || 'http://127.0.0.1:19062';
const pages = {};
for (const path of ['/', '/listings/55']) {
  const runs = [];
  for (let i = 0; i < 3; i++) {
    const browser = await chromium.launch({
      executablePath: '/repl/tools/bin/chromium',
      headless: true,
      args: ['--no-sandbox', '--remote-debugging-port=9223'],
    });
    try {
      const result = await lighthouse(`${base}${path}`, {
        port: 9223, logLevel: 'error', onlyCategories: ['performance'],
        throttlingMethod: 'devtools', formFactor: 'mobile',
        screenEmulation: { mobile: true, width: 390, height: 844, deviceScaleFactor: 1, disabled: false },
        throttling: { rttMs: 150, throughputKbps: 1600, requestLatencyMs: 150,
          downloadThroughputKbps: 1600, uploadThroughputKbps: 750, cpuSlowdownMultiplier: 4 },
        disableFullPageScreenshot: true,
      });
      if (result.lhr.runtimeError) throw new Error(result.lhr.runtimeError.message);
      const audits = result.lhr.audits;
      const run = {
        lcpMs: audits['largest-contentful-paint'].numericValue,
        tbtMs: audits['total-blocking-time'].numericValue,
        fcpMs: audits['first-contentful-paint'].numericValue,
        cls: audits['cumulative-layout-shift'].numericValue,
        requests: audits['network-requests'].details.items.map(item => ({
          // Never retain query strings or auth headers in performance reports.
          url: new URL(item.url).origin + new URL(item.url).pathname,
          bytes: item.transferSize, type: item.resourceType,
        })),
      };
      runs.push(run);
      run.localJsBytes = run.requests.filter(r => r.type === 'Script' && r.url.startsWith(base)).reduce((sum, r) => sum + Math.max(0, r.bytes), 0);
      run.totalJsBytes = run.requests.filter(r => r.type === 'Script').reduce((sum, r) => sum + Math.max(0, r.bytes), 0);
      console.log(path, i + 1, JSON.stringify({ lcpMs: run.lcpMs, tbtMs: run.tbtMs, cls: run.cls, localJsBytes: run.localJsBytes, totalJsBytes: run.totalJsBytes }));
    } finally { await browser.close(); }
  }
  pages[path] = { runs, medianLcpMs: runs.map(r => r.lcpMs).sort((a,b) => a-b)[1],
    medianTbtMs: runs.map(r => r.tbtMs).sort((a,b) => a-b)[1],
    medianCls: runs.map(r => r.cls).sort((a,b) => a-b)[1],
    medianLocalJsBytes: runs.map(r => r.localJsBytes).sort((a,b) => a-b)[1],
    medianTotalJsBytes: runs.map(r => r.totalJsBytes).sort((a,b) => a-b)[1] };
}
const assets = 'artifacts/agri-market/dist/public/assets';
const files = (await readdir(assets)).filter(file => file.endsWith('.js'));
const builtJsBytes = (await Promise.all(files.map(file => stat(`${assets}/${file}`)))).reduce((sum, file) => sum + file.size, 0);
await writeFile(process.argv[2], JSON.stringify({
  method: 'Lighthouse, actual DevTools throttling, cold browser per run; median of 3; 390x844, CPU 4x, 1.6Mbps down, 750Kbps up, 150ms latency; local bundle and real development records',
  pages, builtJsBytes,
}, null, 2));
