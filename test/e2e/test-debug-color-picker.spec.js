import { test } from '@playwright/test';
import {
  waitForAppReady,
  takeScreenshot,
  createNewImage
} from './helpers.js';

test.describe('Debug Color Picker', () => {
  test('View color picker', async ({ page }) => {
    await page.goto('/imgedit.html');
    await waitForAppReady(page);
    await createNewImage(page);

    // Open color picker
    await page.click('#btn-choose-color');
    await page.waitForSelector('#color-picker-hgr[open]', { state: 'visible' });

    // Take screenshot of color picker
    await takeScreenshot(page, 'debug-color-picker-open.png');

    // Count buttons
    const solidCount = await page.locator('#hgr-color-body .swatch-button').count();
    const ditherCount = await page.locator('#hgr-dither-body .swatch-button').count();
    console.log(`Solid colors: ${solidCount}, Dither patterns: ${ditherCount}`);

    // Try clicking each solid color and taking a screenshot
    for (let i = 0; i < Math.min(solidCount, 10); i++) {
      await page.click(`#hgr-color-body .swatch-button:nth-child(${i + 1})`);
      await page.waitForTimeout(100);
      console.log(`Clicked color ${i}`);
    }

    await takeScreenshot(page, 'debug-after-clicking-colors.png');
  });
});
