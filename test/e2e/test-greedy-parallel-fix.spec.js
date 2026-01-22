import { test, expect } from '@playwright/test';
import { waitForAppReady, takeScreenshot } from './helpers.js';

/**
 * Test to verify the greedy-parallel algorithm fix.
 *
 * The parallel version was exhibiting vertical white bars due to race conditions
 * in error propagation. This test verifies that the fix resolves the issue.
 */
test.describe('Greedy Parallel Algorithm Fix', () => {
  test('Parallel and sequential versions produce similar results', async ({ page }) => {
    console.log('=== Test: Greedy Parallel vs Sequential ===');

    await page.goto('/imgedit.html');
    await waitForAppReady(page);

    // Create a test gradient image in the page
    const testResult = await page.evaluate(async () => {
      try {
        // Import the greedy dither module
        const { greedyDitherScanline, greedyDitherScanlineAsync } =
          await import('./lib/greedy-dither.js');
        const { default: NTSCRenderer } = await import('./lib/ntsc-renderer.js');

        // Create a test gradient image (280x1 scanline)
        const width = 280;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = 1;
        const ctx = canvas.getContext('2d');

        // Create a gradient from black to white
        const gradient = ctx.createLinearGradient(0, 0, width, 0);
        gradient.addColorStop(0, '#000000');
        gradient.addColorStop(0.5, '#888888');
        gradient.addColorStop(1, '#ffffff');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, 1);

        // Get pixel data
        const imageData = ctx.getImageData(0, 0, width, 1);
        const pixels = imageData.data;

        // Create shared resources
        const targetWidth = 40; // 280 pixels / 7 bits per byte
        const pixelWidth = 280;
        const height = 1;
        const renderer = new NTSCRenderer();

        // Test sequential version
        const errorBuffer1 = [];
        const seqImageData = new ImageData(560, 1);
        const seqHgrBytes = new Uint8Array(40);
        const seqScanline = greedyDitherScanline(
          pixels,
          errorBuffer1,
          0,
          targetWidth,
          pixelWidth,
          height,
          renderer,
          seqImageData,
          seqHgrBytes
        );

        // Test parallel version
        const errorBuffer2 = [];
        const parScanline = await greedyDitherScanlineAsync(
          pixels,
          errorBuffer2,
          0,
          targetWidth,
          pixelWidth,
          height,
          renderer
        );

        // Compare results
        const differences = [];
        for (let i = 0; i < targetWidth; i++) {
          if (seqScanline[i] !== parScanline[i]) {
            differences.push({
              byte: i,
              sequential: seqScanline[i].toString(16).padStart(2, '0'),
              parallel: parScanline[i].toString(16).padStart(2, '0')
            });
          }
        }

        // Count non-zero bytes (as a sanity check)
        const seqNonZero = Array.from(seqScanline).filter(b => b !== 0).length;
        const parNonZero = Array.from(parScanline).filter(b => b !== 0).length;

        return {
          success: true,
          totalBytes: targetWidth,
          differences: differences,
          differenceCount: differences.length,
          sequentialNonZero: seqNonZero,
          parallelNonZero: parNonZero
        };

      } catch (e) {
        return {
          success: false,
          error: e.toString(),
          stack: e.stack
        };
      }
    });

    console.log('Test result:', JSON.stringify(testResult, null, 2));

    // Take screenshot
    await takeScreenshot(page, 'greedy-parallel-test.png');

    // Verify test succeeded
    expect(testResult.success).toBe(true);

    // The results should be reasonably similar
    // Some differences are acceptable due to floating-point precision and async timing
    // But the parallel version should NOT have mostly zero bytes (which would indicate broken error propagation)
    expect(testResult.parallelNonZero).toBeGreaterThan(10);

    // Log differences if any
    if (testResult.differenceCount > 0) {
      console.log(`Found ${testResult.differenceCount} differences out of ${testResult.totalBytes} bytes`);
      console.log('Differences:', testResult.differences);

      // Allow up to 25% differences (parallel vs sequential may differ slightly)
      const maxAllowedDifferences = Math.ceil(testResult.totalBytes * 0.25);
      expect(testResult.differenceCount).toBeLessThanOrEqual(maxAllowedDifferences);
    }
  });

  test('Parallel version does not produce vertical white bars', async ({ page }) => {
    console.log('=== Test: No White Bars in Parallel ===');

    await page.goto('/imgedit.html');
    await waitForAppReady(page);

    // Create a solid color test
    const testResult = await page.evaluate(async () => {
      try {
        const { greedyDitherScanlineAsync } = await import('./lib/greedy-dither.js');
        const { default: NTSCRenderer } = await import('./lib/ntsc-renderer.js');

        // Create solid gray color (280x1)
        const width = 280;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = 1;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#808080'; // Medium gray
        ctx.fillRect(0, 0, width, 1);

        const imageData = ctx.getImageData(0, 0, width, 1);
        const pixels = imageData.data;

        // Dither with parallel algorithm
        const errorBuffer = [];
        const renderer = new NTSCRenderer();
        const scanline = await greedyDitherScanlineAsync(
          pixels,
          errorBuffer,
          0,
          40,
          280,
          1,
          renderer
        );

        // Check for problematic patterns (too many zeros would indicate white bars)
        const zeroCount = Array.from(scanline).filter(b => b === 0).length;
        const nonZeroCount = 40 - zeroCount;

        return {
          success: true,
          zeroCount,
          nonZeroCount,
          scanline: Array.from(scanline).map(b => b.toString(16).padStart(2, '0'))
        };

      } catch (e) {
        return {
          success: false,
          error: e.toString()
        };
      }
    });

    console.log('White bar test result:', JSON.stringify(testResult, null, 2));
    await takeScreenshot(page, 'greedy-no-white-bars.png');

    expect(testResult.success).toBe(true);

    // For solid gray, we should have a good mix of values, not mostly zeros
    // If error propagation is broken, we'd see mostly zeros (white bars)
    expect(testResult.nonZeroCount).toBeGreaterThan(20);
  });
});
