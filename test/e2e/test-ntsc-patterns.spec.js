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
 * @param {import('@playwright/test').Page} page
 * @param {number} patternIndex - 0-based index of dither pattern
 */
async function selectDitherPattern(page, patternIndex) {
  console.log(`Selecting dither pattern: ${patternIndex}`);

  // Open color picker
  await page.click('#btn-choose-color');
  await page.waitForSelector('#color-picker-hgr[open]', { state: 'visible' });

  // Count available dither patterns
  const ditherCount = await page.locator('#hgr-dither-body .swatch-button').count();
  console.log(`Total dither patterns available: ${ditherCount}`);

  if (patternIndex >= ditherCount) {
    throw new Error(`Pattern index ${patternIndex} out of bounds (max: ${ditherCount - 1})`);
  }

  // Click the dither pattern button using nth-child selector (1-based)
  const selector = `#hgr-dither-body .swatch-button:nth-child(${patternIndex + 1})`;
  await page.click(selector);

  // Close dialog if it's still open
  const dialogOpen = await page.isVisible('#color-picker-hgr[open]');
  if (dialogOpen) {
    await page.click('#hgr-picker-close');
  }

  await page.waitForTimeout(200);
}

/**
 * Helper to draw a labeled test rectangle with a pattern
 */
async function drawTestPattern(page, x, y, width, height, label) {
  console.log(`Drawing test pattern: ${label}`);
  await drawRectangle(page, x, y, x + width, y + height);
}

test.describe('NTSC Dither Pattern Rendering Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/imgedit.html');
    await waitForAppReady(page);
    await createNewImage(page);
  });

  test('CRITICAL: Black/white checkerboard should NOT show color artifacts', async ({ page }) => {
    console.log('=== Test: Black/White Checkerboard Pattern ===');
    console.log('EXPECTED: Should render as black/white, NOT purple/orange stripes');
    console.log('REASON: High frequency alternation (every pixel) should produce luminance only, not color');

    await selectRenderMode(page, 'ntsc');
    await selectTool(page, 'btn-fill-rect');

    // First, take a screenshot of the color picker to identify the checkerboard pattern
    await page.click('#btn-choose-color');
    await page.waitForSelector('#color-picker-hgr[open]', { state: 'visible' });
    await takeScreenshot(page, 'ntsc-pattern-picker-reference.png');

    // Count available dither patterns to understand what we have
    const ditherCount = await page.locator('#hgr-dither-body .swatch-button').count();
    console.log(`Available dither patterns: ${ditherCount}`);

    // Close picker for now
    await page.click('#hgr-picker-close');
    await page.waitForTimeout(200);

    // Test multiple dither patterns to find the checkerboard
    // We'll draw a grid of patterns for visual comparison
    let patternIndex = 0;
    const patternsPerRow = 4;
    const rectWidth = 60;
    const rectHeight = 50;
    const gap = 10;
    const startX = 20;
    const startY = 20;

    // Draw first 12 patterns (or all if fewer)
    const patternsToTest = Math.min(12, ditherCount);

    for (let i = 0; i < patternsToTest; i++) {
      const row = Math.floor(i / patternsPerRow);
      const col = i % patternsPerRow;
      const x = startX + col * (rectWidth + gap);
      const y = startY + row * (rectHeight + gap);

      await selectDitherPattern(page, i);
      await drawTestPattern(page, x, y, rectWidth, rectHeight, `Pattern ${i}`);
    }

    await takeScreenshot(page, 'ntsc-pattern-grid-all.png');

    console.log('✓ Pattern grid rendered in NTSC mode');
    console.log('👀 VISUAL INSPECTION REQUIRED:');
    console.log('   - Identify which pattern is the black/white checkerboard');
    console.log('   - Verify it renders as black/white, NOT purple/orange');
    console.log('   - If showing color, this confirms the NTSC bug');
  });

  test('Test specific dither patterns with labels', async ({ page }) => {
    console.log('=== Test: Individual Dither Patterns with Clear Labels ===');

    await selectRenderMode(page, 'ntsc');
    await selectTool(page, 'btn-fill-rect');

    // Get total pattern count
    await page.click('#btn-choose-color');
    await page.waitForSelector('#color-picker-hgr[open]', { state: 'visible' });
    const ditherCount = await page.locator('#hgr-dither-body .swatch-button').count();
    await page.click('#hgr-picker-close');

    console.log(`Testing ${ditherCount} dither patterns individually`);

    // Draw larger rectangles with more space for analysis
    const rectWidth = 120;
    const rectHeight = 80;
    const startX = 20;
    const startY = 20;
    const gap = 20;

    // Test patterns in a 2-column layout
    const cols = 2;
    const patternsToTest = Math.min(8, ditherCount);

    for (let i = 0; i < patternsToTest; i++) {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const x = startX + col * (rectWidth + gap);
      const y = startY + row * (rectHeight + gap);

      await selectDitherPattern(page, i);
      await drawTestPattern(page, x, y, rectWidth, rectHeight, `Pattern ${i}`);

      // Take individual screenshot for this pattern
      await takeScreenshot(page, `ntsc-pattern-${i}-individual.png`);
    }

    await takeScreenshot(page, 'ntsc-pattern-layout-labeled.png');

    console.log('✓ Individual pattern screenshots created');
    console.log('👀 VISUAL INSPECTION:');
    console.log('   - Compare individual screenshots to identify specific patterns');
    console.log('   - Look for checkerboard pattern showing incorrect colors');
    console.log('   - Look for green/orange alternating row pattern');
  });

  test('Compare RGB vs NTSC rendering of same patterns', async ({ page }) => {
    console.log('=== Test: RGB vs NTSC Mode Comparison ===');

    await selectTool(page, 'btn-fill-rect');

    // Get pattern count
    await page.click('#btn-choose-color');
    await page.waitForSelector('#color-picker-hgr[open]', { state: 'visible' });
    const ditherCount = await page.locator('#hgr-dither-body .swatch-button').count();
    await page.click('#hgr-picker-close');

    const patternsToTest = Math.min(6, ditherCount);
    const rectWidth = 80;
    const rectHeight = 60;
    const startX = 30;
    const startY = 30;
    const gap = 15;

    // First draw in RGB mode
    console.log('Drawing patterns in RGB mode...');
    await selectRenderMode(page, 'rgb');

    for (let i = 0; i < patternsToTest; i++) {
      const row = Math.floor(i / 3);
      const col = i % 3;
      const x = startX + col * (rectWidth + gap);
      const y = startY + row * (rectHeight + gap);

      await selectDitherPattern(page, i);
      await drawTestPattern(page, x, y, rectWidth, rectHeight, `Pattern ${i}`);
    }

    await takeScreenshot(page, 'ntsc-comparison-rgb-mode.png');

    // Now switch to NTSC mode to see the difference
    console.log('Switching to NTSC mode...');
    await selectRenderMode(page, 'ntsc');
    await takeScreenshot(page, 'ntsc-comparison-ntsc-mode.png');

    // Also test in mono mode for reference
    console.log('Switching to Mono mode...');
    await selectRenderMode(page, 'mono');
    await takeScreenshot(page, 'ntsc-comparison-mono-mode.png');

    console.log('✓ Mode comparison screenshots created');
    console.log('👀 VISUAL INSPECTION:');
    console.log('   - Compare RGB vs NTSC to identify color artifact differences');
    console.log('   - High frequency patterns should stay grayscale in NTSC');
    console.log('   - Low frequency patterns may show color in NTSC');
  });

  test('Focused test: Search for checkerboard pattern specifically', async ({ page }) => {
    console.log('=== Test: Focused Checkerboard Search ===');
    console.log('Looking for the pattern that alternates every pixel (high frequency)');

    await selectRenderMode(page, 'ntsc');
    await selectTool(page, 'btn-fill-rect');

    // Get pattern count
    await page.click('#btn-choose-color');
    await page.waitForSelector('#color-picker-hgr[open]', { state: 'visible' });
    const ditherCount = await page.locator('#hgr-dither-body .swatch-button').count();
    console.log(`Testing all ${ditherCount} patterns for checkerboard`);
    await page.click('#hgr-picker-close');

    // Draw each pattern in a single large grid
    const rectWidth = 50;
    const rectHeight = 40;
    const gap = 8;
    const startX = 10;
    const startY = 10;
    const cols = 5;

    for (let i = 0; i < ditherCount; i++) {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const x = startX + col * (rectWidth + gap);
      const y = startY + row * (rectHeight + gap);

      await selectDitherPattern(page, i);
      await drawTestPattern(page, x, y, rectWidth, rectHeight, `P${i}`);
    }

    await takeScreenshot(page, 'ntsc-checkerboard-search-ntsc.png');

    // Also capture in RGB mode for comparison
    await selectRenderMode(page, 'rgb');
    await takeScreenshot(page, 'ntsc-checkerboard-search-rgb.png');

    console.log('✓ Complete pattern grid rendered');
    console.log('👀 VISUAL INSPECTION:');
    console.log('   - Find the checkerboard pattern (alternates every pixel)');
    console.log('   - In RGB mode, it should show as a black/white pattern');
    console.log('   - In NTSC mode, it should ALSO show as black/white (luminance only)');
    console.log('   - If NTSC shows purple/orange stripes, this is the BUG');
  });

  test('Analyze pattern swatch rendering in color picker', async ({ page }) => {
    console.log('=== Test: Color Picker Pattern Swatches ===');
    console.log('Examining how patterns appear in the picker itself');

    // Open color picker
    await page.click('#btn-choose-color');
    await page.waitForSelector('#color-picker-hgr[open]', { state: 'visible' });

    // Take full-page screenshot to capture the entire picker
    await takeScreenshot(page, 'ntsc-color-picker-full.png');

    // Get detailed information about the picker structure
    const ditherCount = await page.locator('#hgr-dither-body .swatch-button').count();
    const solidCount = await page.locator('#hgr-color-body .swatch-button').count();

    console.log(`Color picker contains:`);
    console.log(`  - ${solidCount} solid colors`);
    console.log(`  - ${ditherCount} dither patterns`);

    // Try to get visual information about each pattern swatch
    for (let i = 0; i < Math.min(ditherCount, 20); i++) {
      const selector = `#hgr-dither-body .swatch-button:nth-child(${i + 1})`;
      const isVisible = await page.isVisible(selector);
      console.log(`  Pattern ${i}: ${isVisible ? 'visible' : 'hidden'}`);
    }

    await page.click('#hgr-picker-close');

    console.log('✓ Color picker analysis complete');
    console.log('👀 VISUAL INSPECTION:');
    console.log('   - Compare pattern swatches at bottom of picker');
    console.log('   - User mentioned "pattern swatch at bottom shows expected pattern"');
    console.log('   - Swatches should show the TRUE pattern appearance');
  });

  test('Test green/orange alternating row pattern (user-reported issue)', async ({ page }) => {
    console.log('=== Test: Green/Orange Alternating Rows Pattern ===');
    console.log('EXPECTED: Horizontal bands of green on even rows, orange on odd rows');
    console.log('User screenshot showed this pattern rendering incorrectly in NTSC');

    await selectRenderMode(page, 'ntsc');
    await selectTool(page, 'btn-fill-rect');

    // We need to find which pattern is the green/orange alternating pattern
    // Let's test several patterns that might be it
    await page.click('#btn-choose-color');
    await page.waitForSelector('#color-picker-hgr[open]', { state: 'visible' });
    const ditherCount = await page.locator('#hgr-dither-body .swatch-button').count();
    await page.click('#hgr-picker-close');

    console.log(`Searching through ${ditherCount} patterns for green/orange rows`);

    // Draw all patterns to find the green/orange one
    const rectWidth = 100;
    const rectHeight = 70;
    const gap = 15;
    const startX = 20;
    const startY = 20;
    const cols = 3;

    for (let i = 0; i < Math.min(12, ditherCount); i++) {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const x = startX + col * (rectWidth + gap);
      const y = startY + row * (rectHeight + gap);

      await selectDitherPattern(page, i);
      await drawTestPattern(page, x, y, rectWidth, rectHeight, `P${i}`);
    }

    await takeScreenshot(page, 'ntsc-green-orange-search-ntsc.png');

    // Capture in RGB to see the true colors
    await selectRenderMode(page, 'rgb');
    await takeScreenshot(page, 'ntsc-green-orange-search-rgb.png');

    console.log('✓ Pattern search complete');
    console.log('👀 VISUAL INSPECTION:');
    console.log('   - Find pattern with green/orange alternating rows');
    console.log('   - Verify it renders correctly in NTSC mode');
    console.log('   - Should show clear horizontal color bands');
  });

  test('Pixel-level analysis: Detect color artifacts in checkerboard', async ({ page }) => {
    console.log('=== Test: Pixel-Level Analysis of Pattern Rendering ===');

    await selectRenderMode(page, 'ntsc');
    await selectTool(page, 'btn-fill-rect');

    // Draw a few test patterns in known locations
    const patterns = [0, 1, 2, 3, 4];
    const rectSize = 80;
    const spacing = 100;

    for (let i = 0; i < patterns.length; i++) {
      await selectDitherPattern(page, patterns[i]);
      const x = 50 + (i * spacing);
      const y = 50;
      await drawTestPattern(page, x, y, rectSize, rectSize, `P${patterns[i]}`);
    }

    await takeScreenshot(page, 'ntsc-pixel-analysis-full.png');

    // Now analyze the pixel data for each pattern
    for (let i = 0; i < patterns.length; i++) {
      const x = 50 + (i * spacing);
      const y = 50;

      // Sample a small region in the center of each rectangle
      const sampleSize = 20;
      const sampleX = x + rectSize / 2 - sampleSize / 2;
      const sampleY = y + rectSize / 2 - sampleSize / 2;

      const pixels = await getCanvasPixels(page, sampleX, sampleY, sampleSize, sampleSize);

      // Analyze color variance
      const rgbValues = [];
      for (let j = 0; j < pixels.data.length; j += 4) {
        const r = pixels.data[j];
        const g = pixels.data[j + 1];
        const b = pixels.data[j + 2];
        rgbValues.push({ r, g, b });
      }

      // Calculate color statistics
      const avgR = rgbValues.reduce((sum, c) => sum + c.r, 0) / rgbValues.length;
      const avgG = rgbValues.reduce((sum, c) => sum + c.g, 0) / rgbValues.length;
      const avgB = rgbValues.reduce((sum, c) => sum + c.b, 0) / rgbValues.length;

      console.log(`Pattern ${patterns[i]} color analysis:`);
      console.log(`  Average RGB: (${avgR.toFixed(1)}, ${avgG.toFixed(1)}, ${avgB.toFixed(1)})`);

      // Check if pattern is grayscale (R ≈ G ≈ B) or has color artifacts
      const colorVariance = Math.abs(avgR - avgG) + Math.abs(avgG - avgB) + Math.abs(avgB - avgR);
      if (colorVariance < 30) {
        console.log(`  ✓ Pattern appears grayscale (variance: ${colorVariance.toFixed(1)})`);
      } else {
        console.log(`  ⚠ Pattern has color artifacts (variance: ${colorVariance.toFixed(1)})`);
        console.log(`  ⚠ This may indicate NTSC color artifact bug!`);
      }
    }

    console.log('✓ Pixel analysis complete');
    console.log('👀 INTERPRETATION:');
    console.log('   - High frequency patterns should have LOW color variance (grayscale)');
    console.log('   - If checkerboard shows HIGH color variance, bug confirmed');
  });
});
