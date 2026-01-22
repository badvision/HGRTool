import { test, expect } from '@playwright/test';

test.describe('Module Loading Test', () => {
  test('Check all module imports', async ({ page }) => {
    const loadErrors = [];
    const networkErrors = [];

    // Track network errors
    page.on('response', response => {
      if (response.status() >= 400) {
        networkErrors.push(`${response.status()} - ${response.url()}`);
        console.log(`Network error: ${response.status()} - ${response.url()}`);
      }
    });

    // Track console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log(`Console error: ${msg.text()}`);
        loadErrors.push(msg.text());
      }
    });

    // Track page errors
    page.on('pageerror', err => {
      console.log(`Page error: ${err.toString()}`);
      loadErrors.push(err.toString());
    });

    await page.goto('/imgedit.html');
    await page.waitForTimeout(3000);

    console.log('\n=== Load Errors ===');
    loadErrors.forEach(err => console.log(err));

    console.log('\n=== Network Errors ===');
    networkErrors.forEach(err => console.log(err));

    // Try to manually import each module
    const moduleTests = await page.evaluate(async () => {
      const results = {};

      // Test ImageDither
      try {
        const { default: ImageDither } = await import('./src/lib/image-dither.js');
        results.imageDither = { success: true, hasClass: !!ImageDither };
      } catch (e) {
        results.imageDither = { success: false, error: e.toString() };
      }

      // Test NTSCRenderer
      try {
        const { default: NTSCRenderer } = await import('./src/lib/ntsc-renderer.js');
        results.ntscRenderer = { success: true, hasClass: !!NTSCRenderer };
      } catch (e) {
        results.ntscRenderer = { success: false, error: e.toString() };
      }

      // Test hgr-patterns
      try {
        const module = await import('./src/lib/hgr-patterns.js');
        results.hgrPatterns = {
          success: true,
          hasPatterns: !!module.CANONICAL_PATTERNS,
          patternCount: module.CANONICAL_PATTERNS?.length || 0
        };
      } catch (e) {
        results.hgrPatterns = { success: false, error: e.toString() };
      }

      return results;
    });

    console.log('\n=== Module Test Results ===');
    console.log(JSON.stringify(moduleTests, null, 2));

    expect(loadErrors.length).toBe(0);
    expect(networkErrors.length).toBe(0);
  });
});
