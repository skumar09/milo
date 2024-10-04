import { expect, test } from '@playwright/test';
import { runAccessibilityTest } from '../../libs/accessibility.js';

const miloLibs = process.env.MILO_LIBS || '';
const inputUrls = process.env.INPUT_URL || '';
const testScope = process.env.TEST_SCOPE || 'body';
const wcagTags = process.env.WCAG_TAGS ? process.env.WCAG_TAGS.split(',') : ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const maxViolations = process.env.MAX_VIOLATIONS ? parseInt(process.env.MAX_VIOLATIONS, 10) : 0;

console.log(`Input URL: ${inputUrls}`);


// Convert the input URLs into an array, trim and filter out empty URLs
const urls = inputUrls.split(/[\s,]+/).map((url) => url.trim()).filter((url) => url);

test.describe('Nala Accessibility Test Suite', () => {
  // Check if URLs are provided
  if (urls.length === 0) {
    test('No URLs provided', async () => {
      console.error('No valid URLs were provided for testing.');
      throw new Error('No valid URLs found');
    });
  }

  // Loop through the provided URLs and run accessibility tests
  urls.forEach((url, index) => {
    test(`[Test ${index + 1}] Accessibility Test on ${url}`, async ({ page }) => {
      console.info(`[Test Page]: ${url}`);

      // Error handling for invalid URLs or navigation failures
      try {
        await test.step('Step 1: Go to the page', async () => {
          await page.goto(`${url}${miloLibs}`, { waitUntil: 'domcontentloaded', timeout: 10000 });
          await expect(page).toHaveURL(`${url}${miloLibs}`);
        });
      } catch (error) {
        console.error(`Failed to load page: ${url}. Error: ${error.message}`);
        return;
      }

      // Run accessibility test with error handling
      await test.step('Step 2: Run accessibility test on the page', async () => {
        await runAccessibilityTest(page, testScope, wcagTags, maxViolations);
      });
    });
  });
});
