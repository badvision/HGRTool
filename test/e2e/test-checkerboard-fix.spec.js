import { test, expect } from '@playwright/test';
import {
  waitForAppReady,
  selectTool,
  selectRenderMode,
  drawRectangle,
  takeScreenshot,
  createNewImage,
  getCanvasPixels
} from './helpers.js';

/**
 * Helper to select a dither pattern from the color picker
 */
async function selectDitherPattern(page, patternIndex) {
  console.log(`Selecting dither pattern: ${patternIndex}`);

  await page.click('#btn-choose-color');
  await page.waitForSelector('#color-picker-hgr[open]', { state: 'visible' });

  const ditherCount = await page.locator('#hgr-dither-body .swatch-button').count();
  console.log(`Total dither patterns available: ${ditherCount}`);

  if (patternIndex >= ditherCount) {
    throw new Error(`Pattern index ${patternIndex} out of bounds (max: ${ditherCount - 1})`);
  }

  const selector = `#hgr-dither-body .swatch-button:nth-child(${patternIndex + 1})`;
  await page.click(selector);

  const dialogOpen = await page.isVisible('#color-picker-hgr[open]');
  if (dialogOpen) {
    await page.click('#hgr-picker-close');
  }

  await page.waitForTimeout(200);
}

/**
 * Helper to draw and analyze a pattern
 */
async function drawAndAnalyzePattern(page, patternIndex, x, y, width, height) {
  await selectDitherPattern(page, patternIndex);
  await drawRectangle(page, x, y, x + width, y + height);

  // Sample pixels from center
  const sampleSize = 20;
  const sampleX = x + width / 2 - sampleSize / 2;
  const sampleY = y + height / 2 - sampleSize / 2;

  const pixels = await getCanvasPixels(page, sampleX, sampleY, sampleSize, sampleSize);

  // Calculate average RGB
  let sumR = 0, sumG = 0, sumB = 0, count = 0;
  for (let i = 0; i < pixels.data.length; i += 4) {
    sumR += pixels.data[i];
    sumG += pixels.data[i + 1];
    sumB += pixels.data[i + 2];
    count++;
  }

  const avgR = sumR / count;
  const avgG = sumG / count;
  const avgB = sumB / count;

  // Calculate color variance
  const variance = Math.abs(avgR - avgG) + Math.abs(avgG - avgB) + Math.abs(avgB - avgR);

  return { avgR, avgG, avgB, variance, isGrayscale: variance < 30 };
}

test.describe('Checkerboard Pattern Fix (High-Frequency)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/imgedit.html');
    await waitForAppReady(page);
    await createNewImage(page);
  });

  test('CRITICAL: Patterns 64 and 69 (true checkerboards) must be grayscale', async ({ page }) => {
    console.log('=== Test: True Checkerboard Patterns (64, 69) ===');
    console.log('Pattern 64: even=0x01 (0x55/0x2a), odd=0x02 (0x2a/0x55)');
    console.log('Pattern 69: even=0x01 (0x55/0x2a), odd=0x01 (0x55/0x2a)');
    console.log('Both patterns alternate EVERY PIXEL = HIGH FREQUENCY');
    console.log('EXPECTED: Grayscale (luminance only), NO color artifacts\n');

    await selectRenderMode(page, 'ntsc');
    await selectTool(page, 'btn-fill-rect');

    // Test pattern 64 (pure checkerboard)
    console.log('Testing pattern 64...');
    const result64 = await drawAndAnalyzePattern(page, 64, 30, 30, 100, 80);
    console.log(`Pattern 64: RGB=(${result64.avgR.toFixed(1)}, ${result64.avgG.toFixed(1)}, ${result64.avgB.toFixed(1)}), variance=${result64.variance.toFixed(1)}`);

    // Test pattern 69 (symmetric checkerboard)
    console.log('Testing pattern 69...');
    const result69 = await drawAndAnalyzePattern(page, 69, 150, 30, 100, 80);
    console.log(`Pattern 69: RGB=(${result69.avgR.toFixed(1)}, ${result69.avgG.toFixed(1)}, ${result69.avgB.toFixed(1)}), variance=${result69.variance.toFixed(1)}`);

    await takeScreenshot(page, 'checkerboard-patterns-ntsc.png');

    // Also test in RGB mode for comparison
    await selectRenderMode(page, 'rgb');
    await takeScreenshot(page, 'checkerboard-patterns-rgb.png');

    // Assertions
    console.log('\n=== RESULTS ===');
    if (result64.isGrayscale) {
      console.log('✓ Pattern 64: PASS (grayscale)');
    } else {
      console.log('✗ Pattern 64: FAIL (has color artifacts)');
    }

    if (result69.isGrayscale) {
      console.log('✓ Pattern 69: PASS (grayscale)');
    } else {
      console.log('✗ Pattern 69: FAIL (has color artifacts)');
    }

    expect(result64.isGrayscale).toBe(true);
    expect(result69.isGrayscale).toBe(true);
  });

  test('Verify fix doesn\'t break low-frequency patterns', async ({ page }) => {
    console.log('=== Test: Low-Frequency Patterns Should Still Show Color ===');
    console.log('Testing patterns that SHOULD show color artifacts');

    await selectRenderMode(page, 'ntsc');
    await selectTool(page, 'btn-fill-rect');

    // Test a few random non-checkerboard patterns
    // These should still show some color
    const testPatterns = [2, 3, 4, 5];
    const results = [];

    for (let i = 0; i < testPatterns.length; i++) {
      const patIdx = testPatterns[i];
      const x = 30 + (i % 2) * 120;
      const y = 30 + Math.floor(i / 2) * 90;

      const result = await drawAndAnalyzePattern(page, patIdx, x, y, 100, 70);
      results.push({ pattern: patIdx, ...result });

      console.log(`Pattern ${patIdx}: variance=${result.variance.toFixed(1)} (${result.isGrayscale ? 'grayscale' : 'has color'})`);
    }

    await takeScreenshot(page, 'low-freq-patterns-ntsc.png');

    console.log('\n=== RESULTS ===');
    console.log('At least some low-frequency patterns should show color (this verifies fix didn\'t break color rendering)');

    // At least one pattern should have color (not all grayscale)
    const hasAtLeastOneColor = results.some(r => !r.isGrayscale);
    console.log(hasAtLeastOneColor ? '✓ Color rendering still works' : '✗ All patterns grayscale - fix too aggressive!');

    expect(hasAtLeastOneColor).toBe(true);
  });
});
