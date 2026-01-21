import { test } from '@playwright/test';
import {
  waitForAppReady,
  takeScreenshot,
  createNewImage
} from './helpers.js';

test.describe('Debug Color Click', () => {
  test('Click orange color specifically', async ({ page }) => {
    await page.goto('/imgedit.html');
    await waitForAppReady(page);
    await createNewImage(page);

    // Take screenshot of initial state
    await takeScreenshot(page, 'debug-01-initial.png');

    // Open color picker
    await page.click('#btn-choose-color');
    await page.waitForSelector('#color-picker-hgr[open]', { state: 'visible' });
    await page.waitForTimeout(300);

    // Take screenshot with picker open
    await takeScreenshot(page, 'debug-02-picker-open.png');

    // Click the 4th button (orange) - nth-child is 1-based
    await page.click('#hgr-color-body .swatch-button:nth-child(4)');
    await page.waitForTimeout(300);

    // Take screenshot after click (dialog might still be open)
    await takeScreenshot(page, 'debug-03-after-click.png');

    // Close dialog if still open
    const dialogOpen = await page.isVisible('#color-picker-hgr[open]');
    console.log(`Dialog still open after click: ${dialogOpen}`);
    if (dialogOpen) {
      await page.click('#hgr-picker-close');
      await page.waitForTimeout(300);
    }

    // Take final screenshot
    await takeScreenshot(page, 'debug-04-final.png');

    // Check what color is shown in the pattern box
    const patternBox = await page.locator('.cpd-color-header').screenshot();
    console.log('Pattern box screenshot taken');
  });
});
