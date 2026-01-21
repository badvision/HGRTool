import { test, expect } from '@playwright/test';
import { waitForAppReady, takeScreenshot, createNewImage } from './helpers.js';

test.describe('Test 0: Sanity Check', () => {
  test('Application loads successfully', async ({ page }) => {
    console.log('=== Sanity Test: Application Loading ===');

    // Navigate to the application
    await page.goto('/imgedit.html');

    // Wait for app to be ready
    await waitForAppReady(page);

    // Verify critical elements exist
    const canvas = await page.locator('#edit-surface');
    await expect(canvas).toBeVisible();

    const leftBar = await page.locator('#leftbar');
    await expect(leftBar).toBeVisible();

    const topBar = await page.locator('#topbar');
    await expect(topBar).toBeVisible();

    const bottomBar = await page.locator('#bottombar');
    await expect(bottomBar).toBeVisible();

    console.log('All critical UI elements found');

    // Take screenshot of initial state
    await takeScreenshot(page, 'sanity-initial-load.png');
  });

  test('Can create new blank image', async ({ page }) => {
    console.log('=== Sanity Test: Create New Image ===');

    await page.goto('/imgedit.html');
    await waitForAppReady(page);

    // Create new image
    await createNewImage(page);

    // Verify canvas is present and visible
    const canvas = await page.locator('#edit-surface');
    await expect(canvas).toBeVisible();

    // Take screenshot
    await takeScreenshot(page, 'sanity-blank-canvas.png');

    console.log('Blank canvas created successfully');
  });

  test('Can open color picker', async ({ page }) => {
    console.log('=== Sanity Test: Color Picker ===');

    await page.goto('/imgedit.html');
    await waitForAppReady(page);
    await createNewImage(page);

    // Click color picker button
    await page.click('#btn-choose-color');

    // Wait for dialog to appear
    await page.waitForSelector('#color-picker-hgr[open]', { state: 'visible' });

    // Verify color picker is visible
    const colorPicker = await page.locator('#color-picker-hgr');
    await expect(colorPicker).toBeVisible();

    // Take screenshot
    await takeScreenshot(page, 'sanity-color-picker.png');

    // Close dialog
    await page.click('#hgr-picker-close');

    console.log('Color picker opens and closes correctly');
  });

  test('Can select tools', async ({ page }) => {
    console.log('=== Sanity Test: Tool Selection ===');

    await page.goto('/imgedit.html');
    await waitForAppReady(page);
    await createNewImage(page);

    // Test selecting various tools
    const tools = [
      'btn-fill-rect',
      'btn-stroke-rect',
      'btn-line',
      'btn-scribble',
      'btn-fill-ellipse',
      'btn-stroke-ellipse',
    ];

    for (const toolId of tools) {
      console.log(`Selecting tool: ${toolId}`);
      await page.click(`#${toolId}`);
      await page.waitForTimeout(100);
    }

    await takeScreenshot(page, 'sanity-tools-selected.png');

    console.log('All tools can be selected');
  });

  test('Can open settings dialog', async ({ page }) => {
    console.log('=== Sanity Test: Settings Dialog ===');

    await page.goto('/imgedit.html');
    await waitForAppReady(page);

    // Open settings
    await page.click('#btn-settings');

    // Wait for dialog
    await page.waitForSelector('#settings[open]', { state: 'visible' });

    // Verify settings dialog is visible
    const settings = await page.locator('#settings');
    await expect(settings).toBeVisible();

    // Verify render mode options exist
    const rgbRadio = await page.locator('#render-mode-rgb');
    await expect(rgbRadio).toBeVisible();

    const ntscRadio = await page.locator('#render-mode-ntsc');
    await expect(ntscRadio).toBeVisible();

    const monoRadio = await page.locator('#render-mode-mono');
    await expect(monoRadio).toBeVisible();

    await takeScreenshot(page, 'sanity-settings-dialog.png');

    // Close dialog
    await page.click('#settings-ok');

    console.log('Settings dialog works correctly');
  });
});
