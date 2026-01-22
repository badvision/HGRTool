import { test, expect } from '@playwright/test';
import { waitForAppReady, takeScreenshot } from './helpers.js';
import fs from 'fs';
import path from 'path';

test.describe('Image Import Feature', () => {
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    // Capture console messages
    consoleMessages = [];
    page.on('console', msg => {
      const text = `[${msg.type()}] ${msg.text()}`;
      consoleMessages.push(text);
      console.log(text);
    });

    // Capture page errors
    pageErrors = [];
    page.on('pageerror', err => {
      const text = `PAGE ERROR: ${err.toString()}`;
      pageErrors.push(text);
      console.log(text);
    });
  });

  test('Import button exists and is visible', async ({ page }) => {
    console.log('=== Test: Import Button Visibility ===');

    await page.goto('/imgedit.html');
    await waitForAppReady(page);

    // Check if Import button exists
    const importButton = page.locator('#btn-import');
    await expect(importButton).toBeVisible();

    // Check button properties
    const isEnabled = await importButton.isEnabled();
    console.log(`Import button enabled: ${isEnabled}`);

    await takeScreenshot(page, 'import-button-visible.png');

    // Verify no errors during page load
    const errors = pageErrors.filter(e => e.includes('ERROR'));
    if (errors.length > 0) {
      console.log('Errors found:');
      errors.forEach(e => console.log(`  ${e}`));
    }
    expect(errors.length).toBe(0);
  });

  test('Import button click triggers handler', async ({ page }) => {
    console.log('=== Test: Import Button Click ===');

    await page.goto('/imgedit.html');
    await waitForAppReady(page);

    const importButton = page.locator('#btn-import');

    // Click the button
    console.log('Clicking Import button...');
    await importButton.click();

    // Wait a moment for any reactions
    await page.waitForTimeout(1000);

    // Check console for any messages related to import
    console.log('\nConsole messages after click:');
    consoleMessages.forEach(msg => console.log(`  ${msg}`));

    // Check for errors
    if (pageErrors.length > 0) {
      console.log('\nErrors after click:');
      pageErrors.forEach(err => console.log(`  ${err}`));
    }

    await takeScreenshot(page, 'import-button-clicked.png');
  });

  test('Check ImageDither module loading', async ({ page }) => {
    console.log('=== Test: Module Loading ===');

    await page.goto('/imgedit.html');
    await waitForAppReady(page);

    // Check if ImageDither is available in window scope
    const imageDitherAvailable = await page.evaluate(() => {
      try {
        // Check if imageEditor instance exists
        if (!window.imageEditor) {
          return { error: 'window.imageEditor not found' };
        }

        // Check if we can access the ImageDither constructor
        // The module should be imported in image-editor.js
        return { success: true };
      } catch (e) {
        return { error: e.toString() };
      }
    });

    console.log('ImageDither check:', imageDitherAvailable);

    // Check for module loading errors
    const moduleErrors = consoleMessages.filter(msg =>
      msg.includes('Failed to load') ||
      msg.includes('Cannot find module') ||
      msg.includes('import')
    );

    if (moduleErrors.length > 0) {
      console.log('\nModule loading issues:');
      moduleErrors.forEach(err => console.log(`  ${err}`));
    }

    // Take screenshot
    await takeScreenshot(page, 'module-check.png');
  });

  test('Create test image and attempt import', async ({ page }) => {
    console.log('=== Test: Full Import Flow ===');

    // Create a simple test image using page context
    await page.goto('/imgedit.html');
    await waitForAppReady(page);

    // Create test image using canvas in browser
    const testImageDataUrl = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 100;
      canvas.height = 100;
      const ctx = canvas.getContext('2d');

      // Draw a gradient
      const gradient = ctx.createLinearGradient(0, 0, 100, 100);
      gradient.addColorStop(0, 'black');
      gradient.addColorStop(0.5, 'gray');
      gradient.addColorStop(1, 'white');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 100, 100);

      return canvas.toDataURL('image/png');
    });

    // Convert data URL to buffer and save
    const base64Data = testImageDataUrl.replace(/^data:image\/png;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const testImagePath = path.join('/tmp', 'test-import-image.png');
    fs.writeFileSync(testImagePath, buffer);
    console.log(`Test image created at: ${testImagePath}`);

    // Set up file chooser handler
    const fileChooserPromise = page.waitForEvent('filechooser');

    // Click import button
    console.log('Clicking Import button...');
    await page.click('#btn-import');

    // Wait for file chooser
    let fileChooser;
    try {
      fileChooser = await fileChooserPromise;
      console.log('File chooser appeared!');

      // Select the test image
      await fileChooser.setFiles(testImagePath);
      console.log('File selected');

      // Wait for import to complete
      await page.waitForTimeout(2000);

      // Check if image was imported (look for picture in list)
      const thumbnailCount = await page.locator('#rightbar .right-pic').count();
      console.log(`Pictures in list: ${thumbnailCount}`);

      // Take screenshot of result
      await takeScreenshot(page, 'import-complete.png');

      // Verify import succeeded
      expect(thumbnailCount).toBeGreaterThan(0);

    } catch (e) {
      console.log(`Error during import: ${e.toString()}`);

      // Log all console messages
      console.log('\nAll console messages:');
      consoleMessages.forEach(msg => console.log(`  ${msg}`));

      // Log all errors
      console.log('\nAll errors:');
      pageErrors.forEach(err => console.log(`  ${err}`));

      await takeScreenshot(page, 'import-failed.png');
      throw e;
    } finally {
      // Cleanup
      if (fs.existsSync(testImagePath)) {
        fs.unlinkSync(testImagePath);
      }
    }
  });

  test('Verify ImageDither can be instantiated', async ({ page }) => {
    console.log('=== Test: ImageDither Instantiation ===');

    await page.goto('/imgedit.html');
    await waitForAppReady(page);

    // Try to instantiate ImageDither in page context
    const ditherTest = await page.evaluate(async () => {
      try {
        // Dynamically import the module
        const { default: ImageDither } = await import('./src/lib/image-dither.js');

        // Try to create instance
        const dither = new ImageDither();

        return {
          success: true,
          hasCanonicalPatterns: !!dither.canonicalPatterns,
          patternCount: dither.canonicalPatterns?.length || 0,
          hasNtscRenderer: !!dither.ntscRenderer
        };
      } catch (e) {
        return {
          success: false,
          error: e.toString(),
          stack: e.stack
        };
      }
    });

    console.log('ImageDither instantiation test:', JSON.stringify(ditherTest, null, 2));

    // Take screenshot
    await takeScreenshot(page, 'dither-instantiation.png');

    // Verify success
    expect(ditherTest.success).toBe(true);
    if (ditherTest.success) {
      expect(ditherTest.patternCount).toBeGreaterThan(0);
    }
  });
});
