/* eslint-disable import/no-extraneous-dependencies */

const { devices } = require('@playwright/test');
const path = require('path');

console.log('Global Setup Path:', path.resolve(__dirname, './utils/global.setup.js'));
console.log('Test Directory Path:', path.resolve(__dirname, '../nala'));


const config = {
  testDir: path.resolve(__dirname, '../nala'),
  outputDir: path.resolve(__dirname, '../test-results'),
  globalSetup: path.resolve(__dirname, './utils/global.setup.js'),
  /* Maximum time one test can run for. */
  timeout: 30 * 1000,
  expect: {
    /**
     * Maximum time expect() should wait for the condition to be met.
     * For example in `await expect(locator).toHaveText();`
     */
    timeout: 5000,
  },
  testMatch: '**/accessibility.test.js',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 1 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 4 : 3,
  /* Reporter to use. */
  reporter: process.env.CI
    ? [['github'], ['list'], ['./utils/base-reporter.js']]
    : [['html', { outputFolder: 'test-html-results' }], ['list'], ['./utils/base-reporter.js']],
  use: {
    /* Maximum time each action such as `click()` can take. Defaults to 0 (no limit). */
    actionTimeout: 60000,

    trace: 'on-first-retry',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'milo-live-chromium',
      use: { ...devices['Desktop Chrome'],
        extraHTTPHeaders: {
          'sec-ch-ua': '"Chromium"',
        },
       },
    },
    {
      name: 'milo-live-firefox',
      use: { ...devices['Desktop Firefox'] },
    },
  ],
};

module.exports = config;
