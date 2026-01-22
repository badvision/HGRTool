import { test, expect } from '@playwright/test';
import { waitForAppReady, takeScreenshot } from './helpers.js';

test.describe('Import Button Debug', () => {
  test('Debug import button handler', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];

    // Capture all console messages
    page.on('console', msg => {
      const text = `[${msg.type()}] ${msg.text()}`;
      consoleMessages.push(text);
      console.log(text);
    });

    // Capture page errors
    page.on('pageerror', err => {
      const text = `PAGE ERROR: ${err.toString()}`;
      pageErrors.push(text);
      console.log(text);
    });

    await page.goto('/imgedit.html');
    await waitForAppReady(page);

    // Check if handler is attached
    const handlerCheck = await page.evaluate(() => {
      const btn = document.getElementById('btn-import');
      if (!btn) return { error: 'Button not found' };

      // Check onclick
      const hasOnClick = !!btn.onclick;

      // Check event listeners (this won't show addEventListener listeners in Chrome)
      // but we can try to trigger the event manually
      return {
        exists: true,
        hasOnClick,
        tagName: btn.tagName,
        id: btn.id
      };
    });

    console.log('Handler check:', JSON.stringify(handlerCheck, null, 2));

    // Now manually invoke the handler to see what happens
    const handlerResult = await page.evaluate(() => {
      try {
        // Access the imageEditor instance
        if (!window.imageEditor) {
          return { error: 'window.imageEditor not found' };
        }

        // Try to call the method directly
        if (typeof window.imageEditor.handleImportImage !== 'function') {
          return { error: 'handleImportImage is not a function', type: typeof window.imageEditor.handleImportImage };
        }

        // Call it and see what happens
        const result = window.imageEditor.handleImportImage();

        return {
          success: true,
          resultType: typeof result,
          isPromise: result instanceof Promise
        };
      } catch (e) {
        return {
          error: e.toString(),
          stack: e.stack,
          name: e.name,
          message: e.message
        };
      }
    });

    console.log('\nDirect handler invocation result:', JSON.stringify(handlerResult, null, 2));

    // Wait for any async operations
    await page.waitForTimeout(2000);

    // Check console for errors
    const errors = consoleMessages.filter(msg =>
      msg.includes('error') ||
      msg.includes('Error') ||
      msg.includes('failed') ||
      msg.includes('Failed')
    );

    if (errors.length > 0) {
      console.log('\nErrors found:');
      errors.forEach(err => console.log(`  ${err}`));
    }

    if (pageErrors.length > 0) {
      console.log('\nPage errors:');
      pageErrors.forEach(err => console.log(`  ${err}`));
    }

    await takeScreenshot(page, 'import-debug.png');
  });
});
