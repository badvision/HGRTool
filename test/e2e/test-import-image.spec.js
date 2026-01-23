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

    // Verify import dialog opens
    console.log('Waiting for import dialog to open...');
    await page.waitForSelector('#import-dialog[open]', { timeout: 5000 });
    console.log('Import dialog opened successfully!');

    // Check for dialog elements
    const selectFileButton = page.locator('#import-select-file');
    await expect(selectFileButton).toBeVisible();

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

    // Extract base64 data from data URL
    const base64Data = testImageDataUrl.replace(/^data:image\/png;base64,/, '');
    console.log(`Test image created (${base64Data.length} bytes base64)`);

    // Set up File System Access API mock before navigating
    await page.addInitScript((base64Data) => {
      window.showOpenFilePicker = async function() {
        // Convert base64 to Blob
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'image/png' });

        // Create a File object
        const file = new File([blob], 'test-import.png', { type: 'image/png' });

        // Mock FileSystemFileHandle
        const fileHandle = {
          kind: 'file',
          name: 'test-import.png',
          getFile: async () => file
        };

        return [fileHandle];
      };
    }, base64Data);

    // Now navigate to the page
    await page.goto('/imgedit.html');
    await waitForAppReady(page);

    // Click import button to open dialog
    console.log('Clicking Import button...');
    await page.click('#btn-import');

    // Wait for import dialog to open
    console.log('Waiting for import dialog...');
    await page.waitForSelector('#import-dialog[open]', { timeout: 5000 });
    console.log('Import dialog opened!');

    // Click select file button in dialog (this will trigger the mocked API)
    console.log('Clicking Select File button...');
    await page.click('#import-select-file');

    try {
      console.log('Waiting for preview section...');

      // Wait for preview section to appear
      await page.waitForSelector('#import-preview-section', { state: 'visible', timeout: 5000 });
      console.log('Preview section visible!');

      // Click Convert button to complete import
      console.log('Clicking Convert button...');
      await page.click('#import-convert');

      // Wait for import to complete and dialog to close (not have open attribute)
      await page.waitForFunction(() => {
        const dialog = document.getElementById('import-dialog');
        return !dialog.hasAttribute('open');
      }, { timeout: 10000 });
      console.log('Import dialog closed!');

      // Wait for processing to complete
      await page.waitForTimeout(1000);

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
