import { test, expect } from '@playwright/test';

test.describe('Syntax Check', () => {
  test('Check for JavaScript syntax errors', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];

    // Capture all console messages
    page.on('console', msg => {
      consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
    });

    // Capture page errors
    page.on('pageerror', err => {
      pageErrors.push(`ERROR: ${err.toString()}`);
      console.log(`PAGE ERROR: ${err.toString()}`);
    });

    await page.goto('/imgedit.html');
    await page.waitForTimeout(2000);

    // Check for syntax errors or loading errors
    const syntaxErrors = consoleMessages.filter(msg =>
      msg.includes('SyntaxError') ||
      msg.includes('Unexpected') ||
      msg.includes('import')
    );

    console.log('=== All Console Messages ===');
    consoleMessages.forEach(msg => console.log(msg));

    console.log('\n=== Page Errors ===');
    pageErrors.forEach(err => console.log(err));

    if (syntaxErrors.length > 0) {
      console.log('\n=== Syntax Errors ===');
      syntaxErrors.forEach(err => console.log(err));
    }

    // Check if ImageEditor class was created properly
    const editorCheck = await page.evaluate(() => {
      if (!window.imageEditor) {
        return { error: 'imageEditor not created' };
      }

      // List all methods on imageEditor
      const methods = [];
      for (const key in window.imageEditor) {
        if (typeof window.imageEditor[key] === 'function') {
          methods.push(key);
        }
      }

      return {
        exists: true,
        methodCount: methods.length,
        hasSave: methods.includes('handleSave'),
        hasOpen: methods.includes('handleOpen'),
        hasImport: methods.includes('handleImportImage'),
        importImageFileExists: methods.includes('importImageFile'),
        methods: methods.filter(m => m.includes('handle') || m.includes('import')).sort()
      };
    });

    console.log('\n=== ImageEditor Check ===');
    console.log(JSON.stringify(editorCheck, null, 2));

    expect(pageErrors.length).toBe(0);
  });
});
