import { defineConfig } from '@playwright/test';

const baseURL =
  process.env.E2E_BASE_URL ??
  (process.env.REPLIT_DEV_DOMAIN
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : undefined);

export default defineConfig({
  testDir: './',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'dot' : 'list',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    launchOptions: {
      executablePath: process.env.REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    },
    // Network traces can capture bearer tokens and cookies. Keep them disabled.
    trace: 'off',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'general-e2e',
      testMatch: '**/*.spec.ts',
      testIgnore: ['**/payment-review-flow.spec.ts', '**/report-support-history.spec.ts'],
    },
    {
      name: 'payment-review-auth',
      testMatch: '**/payment-review-auth.setup.ts',
    },
    {
      name: 'payment-review',
      testMatch: '**/payment-review-flow.spec.ts',
      dependencies: ['payment-review-auth'],
    },
    {
      name: 'report-support-history-auth',
      testMatch: '**/report-support-history-auth.setup.ts',
    },
    {
      name: 'report-support-history',
      testMatch: '**/report-support-history.spec.ts',
      dependencies: ['report-support-history-auth'],
    },
  ],
});
