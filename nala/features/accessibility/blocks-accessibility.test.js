import { expect, test } from '@playwright/test';
import { features } from './blocks-accessibility.spec.js';
import { runAccessibilityTest } from '../../libs/accessibility.js';

const miloLibs = process.env.MILO_LIBS || '';

test.describe('Milo Blocks Accessibility Test Suite', () => {
  // Loop through each feature and its paths
  features.forEach((feature) => {
    feature.paths.forEach((blockPath) => {
      // Ensure unique test title by appending path and variant
      test(`[Test Id - ${feature.tcid} ${feature.name}: ${blockPath.variant} (${blockPath.path})], ${feature.tags}`, async ({ page, baseURL }) => {
        const fullPath = `${baseURL}${blockPath.path}${miloLibs}`;
        console.info(`[Test Page]: ${fullPath} [Variant: ${blockPath.variant}]`);

        await test.step(`Step 1: Go to ${feature.name} (${blockPath.variant}) page`, async () => {
          await page.goto(fullPath, { waitUntil: 'domcontentloaded' });
          await page.waitForLoadState('domcontentloaded');
          await expect(page).toHaveURL(fullPath);
        });

        // Run accessibility test for all variants
        await test.step(`Step 2: Run accessibility test for ${blockPath.variant}`, async () => {
          await runAccessibilityTest(page);
        });
      });
    });
  });
});
