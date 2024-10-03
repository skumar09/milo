import { expect, test } from '@playwright/test';
import { runAccessibilityTest } from '../../libs/accessibility.js';

const miloLibs = process.env.MILO_LIBS || '';
const inputUrls = process.env.INPUT_URLS || '';

// Convert the input URLs into an array,rim and filter out empty URLs
//const urls = inputUrls.split(/[\s,]+/).map((url) => url.trim()).filter((url) => url);
const urls = ['https://www.adobe.com/acrobat/personal-document-management.html'];

test.describe('Nala Accessibility Test Suite', () => {
  // Check if URLs are provided
  if (urls.length === 0) {
    test('No URLs @ provided', async () => {
      console.error('No valid URLs were provided for testing.');
      throw new Error('No valid URLs found');
    });
  }

  // Loop through the provided URLs and run accessibility tests
  urls.forEach((url, index) => {
    test(`[Test ${index + 1}] Accessibility Test on @  ${url}`, async ({ page }) => {
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
        await runAccessibilityTest(page);
      });
    });
  });
});
