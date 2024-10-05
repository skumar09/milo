/* eslint-disable import/no-extraneous-dependencies */

const { devices } = require('@playwright/test');

const config = {
  testDir: '../../nala',
  outputDir: '../../test-results',
  globalSetup: '../utils/global.setup.js',
  /* Maximum time one test can run for. */
  timeout: 30 * 1000,
  expect: {
    /**
     * Maximum time expect() should wait for the condition to be met.
     * For example in `await expect(locator).toHaveText();`
     */
    timeout: 5000,
  },
  testMatch: '**/*accessibility.test.js',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 0 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 4 : 3,
  /* Reporter to use. */
  reporter: process.env.CI
    ? [
      ['list'],
      ['../utils/a11y-base-reporter.js'],
    ]
    : [
      ['list'],
      ['../utils/a11y-base-reporter.js'],
    ],
  use: {
    /* Maximum time each action such as `click()` can take. Defaults to 0 (no limit). */
    actionTimeout: 60000,

    baseURL: 'https://stage--milo--adobecom.hlx.live',

    trace: 'on-first-retry',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'milo-live-chromium',
      use: {
        ...devices['Desktop Chrome'],
        extraHTTPHeaders: { 'sec-ch-ua': '"Chromium"' },
      },
    },
  ],
};

module.exports = config;
