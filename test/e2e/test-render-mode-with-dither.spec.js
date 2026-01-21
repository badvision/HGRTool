import { test, expect } from '@playwright/test';
import {
  waitForAppReady,
  selectTool,
  selectDitherPattern,
  selectRenderMode,
  drawRectangle,
  takeScreenshot,
  getCanvasPixels,
  createNewImage
} from './helpers.js';

/**
 * Helper to check if a pixel has color (not grayscale)
 * @param {number[]} pixel - [R, G, B] values
 * @returns {boolean} True if pixel has color
 */
function hasColor(pixel) {
  const [r, g, b] = pixel;
  // If R, G, B are not all equal, it has color
  // Allow small tolerance for compression artifacts
  const tolerance = 5;
  return Math.abs(r - g) > tolerance || Math.abs(g - b) > tolerance || Math.abs(r - b) > tolerance;
}

/**
 * Helper to check if a pixel is grayscale
 * @param {number[]} pixel - [R, G, B] values
 * @returns {boolean} True if pixel is grayscale (R=G=B within tolerance)
 */
function isGrayscale(pixel) {
  return !hasColor(pixel);
}

/**
 * Helper to check if two pixels are different
 * @param {number[]} pixel1 - [R, G, B] values
 * @param {number[]} pixel2 - [R, G, B] values
 * @returns {boolean} True if pixels are significantly different
 */
function pixelsAreDifferent(pixel1, pixel2) {
  const [r1, g1, b1] = pixel1;
  const [r2, g2, b2] = pixel2;
  const threshold = 20; // Pixels must differ by at least this much
  return (
    Math.abs(r1 - r2) > threshold ||
    Math.abs(g1 - g2) > threshold ||
    Math.abs(b1 - b2) > threshold
  );
}

test.describe('Render Mode Switching with Colored Dither Patterns', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/imgedit.html');
    await waitForAppReady(page);
    await createNewImage(page);
  });

  test('Colored dither pattern shows different rendering in RGB/NTSC/Mono modes', async ({ page }) => {
    console.log('=== Test: Colored Dither Pattern Mode Switching ===');

    // Select rectangle tool
    await selectTool(page, 'btn-fill-rect');

    // Draw in RGB mode FIRST (before selecting pattern, draw with default)
    console.log('Step 1: Setting RGB mode');
    await selectRenderMode(page, 'rgb');
    await page.waitForTimeout(300);

    // Select a colored dither pattern (pattern 1 is green/purple alternating - 0x55/0x2a)
    // This should show distinct colors in RGB/NTSC but be grayscale in Mono
    console.log('Step 2: Selecting colored dither pattern (index 1)');
    await selectDitherPattern(page, 1);
    await page.waitForTimeout(300);

    // Draw rectangle (use larger area for better sampling)
    console.log('Step 3: Drawing rectangle in RGB mode');
    await drawRectangle(page, 100, 50, 300, 150);
    await page.waitForTimeout(500);
    await takeScreenshot(page, 'dither-rgb-mode.png');

    // Sample pixels from the drawn area
    // Try sampling a 3x3 area and look for the colored pixels (not white)
    // Rectangle appears to span viewport coords (414-503, 143-212)
    // Canvas starts at (200, 68), so canvas-relative coords are (214-303, 75-144)
    // Sample a region to find colored pixels
    const sampleSize = 10;
    const rgbPixels = await getCanvasPixels(page, 258, 110, sampleSize, sampleSize);

    // Find a non-white pixel in the sample
    let rgbPixel = null;
    for (let i = 0; i < rgbPixels.data.length; i += 4) {
      const r = rgbPixels.data[i];
      const g = rgbPixels.data[i + 1];
      const b = rgbPixels.data[i + 2];
      // Skip white pixels (255, 255, 255) and black pixels (0, 0, 0)
      if (r < 250 && (r > 10 || g > 10 || b > 10)) {
        rgbPixel = [r, g, b];
        break;
      }
    }

    if (!rgbPixel) {
      // Fallback to center pixel if we didn't find a colored one
      rgbPixel = [rgbPixels.data[0], rgbPixels.data[1], rgbPixels.data[2]];
    }

    console.log('RGB mode pixel:', rgbPixel);

    // Verify RGB mode has color
    expect(hasColor(rgbPixel)).toBe(true);
    console.log('✓ RGB mode shows color');

    // Switch to NTSC mode
    console.log('Step 4: Switching to NTSC mode');
    await selectRenderMode(page, 'ntsc');
    await page.waitForTimeout(800); // Give extra time for re-render
    await takeScreenshot(page, 'dither-ntsc-mode.png');

    // Sample same region in NTSC mode and find a colored pixel
    const ntscPixels = await getCanvasPixels(page, 258, 110, sampleSize, sampleSize);

    // Find a non-white pixel in the sample
    let ntscPixel = null;
    for (let i = 0; i < ntscPixels.data.length; i += 4) {
      const r = ntscPixels.data[i];
      const g = ntscPixels.data[i + 1];
      const b = ntscPixels.data[i + 2];
      // Skip white pixels (255, 255, 255) and black pixels (0, 0, 0)
      if (r < 250 && (r > 10 || g > 10 || b > 10)) {
        ntscPixel = [r, g, b];
        break;
      }
    }

    if (!ntscPixel) {
      // Fallback to center pixel if we didn't find a colored one
      ntscPixel = [ntscPixels.data[0], ntscPixels.data[1], ntscPixels.data[2]];
    }

    console.log('NTSC mode pixel:', ntscPixel);

    // Verify NTSC mode has color
    expect(hasColor(ntscPixel)).toBe(true);
    console.log('✓ NTSC mode shows color');

    // Verify RGB and NTSC pixels are different
    expect(pixelsAreDifferent(rgbPixel, ntscPixel)).toBe(true);
    console.log('✓ RGB and NTSC pixels are different colors');

    // Switch to Mono mode
    console.log('Step 5: Switching to Mono mode');
    await selectRenderMode(page, 'mono');
    await page.waitForTimeout(800); // Give extra time for re-render
    await takeScreenshot(page, 'dither-mono-mode.png');

    // Sample same region in Mono mode and find any non-black pixel
    const monoPixels = await getCanvasPixels(page, 258, 110, sampleSize, sampleSize);

    // For mono, just find any non-black/white pixel (should all be grayscale)
    let monoPixel = null;
    for (let i = 0; i < monoPixels.data.length; i += 4) {
      const r = monoPixels.data[i];
      const g = monoPixels.data[i + 1];
      const b = monoPixels.data[i + 2];
      // Skip pure white (255, 255, 255) and pure black (0, 0, 0)
      if (r > 10 && r < 250) {
        monoPixel = [r, g, b];
        break;
      }
    }

    if (!monoPixel) {
      // Fallback to center pixel
      monoPixel = [monoPixels.data[0], monoPixels.data[1], monoPixels.data[2]];
    }

    console.log('Mono mode pixel:', monoPixel);

    // Verify Mono mode is grayscale (R=G=B)
    expect(isGrayscale(monoPixel)).toBe(true);
    console.log('✓ Mono mode shows grayscale');

    // Verify Mono pixel is different from RGB and NTSC
    expect(pixelsAreDifferent(monoPixel, rgbPixel)).toBe(true);
    expect(pixelsAreDifferent(monoPixel, ntscPixel)).toBe(true);
    console.log('✓ Mono pixel is different from RGB and NTSC pixels');

    // Switch back to RGB to verify round-trip
    console.log('Step 6: Switching back to RGB mode');
    await selectRenderMode(page, 'rgb');
    await page.waitForTimeout(800); // Give extra time for re-render
    await takeScreenshot(page, 'dither-rgb-mode-after.png');

    // Verify RGB mode is restored
    const rgbPixels2 = await getCanvasPixels(page, 258, 110, 1, 1);
    const rgbPixel2 = [rgbPixels2.data[0], rgbPixels2.data[1], rgbPixels2.data[2]];
    console.log('RGB mode pixel (after round-trip):', rgbPixel2);

    expect(hasColor(rgbPixel2)).toBe(true);
    console.log('✓ RGB mode restored with color');

    console.log('=== Test Complete: All mode switches verified ===');
  });

  test('Multiple dither patterns show color differences across modes', async ({ page }) => {
    console.log('=== Test: Multiple Colored Dither Patterns ===');

    await selectTool(page, 'btn-fill-rect');

    // Pattern 1: green/purple alternating
    console.log('Drawing pattern 1 (green/purple)');
    await selectRenderMode(page, 'rgb');
    await selectDitherPattern(page, 1);
    await drawRectangle(page, 50, 80, 130, 120);

    // Pattern 8: complex colored pattern
    console.log('Drawing pattern 8');
    await selectDitherPattern(page, 8);
    await drawRectangle(page, 140, 80, 220, 120);

    // Pattern 15: another complex pattern
    console.log('Drawing pattern 15');
    await selectDitherPattern(page, 15);
    await drawRectangle(page, 230, 80, 310, 120);

    await takeScreenshot(page, 'multi-patterns-rgb.png');

    // Sample center pixel of each pattern in RGB
    const p1rgb = await getCanvasPixels(page, 90, 100, 1, 1);
    const p2rgb = await getCanvasPixels(page, 180, 100, 1, 1);
    const p3rgb = await getCanvasPixels(page, 270, 100, 1, 1);

    const p1rgbPixel = [p1rgb.data[0], p1rgb.data[1], p1rgb.data[2]];
    const p2rgbPixel = [p2rgb.data[0], p2rgb.data[1], p2rgb.data[2]];
    const p3rgbPixel = [p3rgb.data[0], p3rgb.data[1], p3rgb.data[2]];

    console.log('RGB pattern 1:', p1rgbPixel);
    console.log('RGB pattern 2:', p2rgbPixel);
    console.log('RGB pattern 3:', p3rgbPixel);

    // All should have color in RGB
    expect(hasColor(p1rgbPixel)).toBe(true);
    expect(hasColor(p2rgbPixel)).toBe(true);
    expect(hasColor(p3rgbPixel)).toBe(true);

    // Switch to NTSC
    await selectRenderMode(page, 'ntsc');
    await page.waitForTimeout(500);
    await takeScreenshot(page, 'multi-patterns-ntsc.png');

    const p1ntsc = await getCanvasPixels(page, 90, 100, 1, 1);
    const p2ntsc = await getCanvasPixels(page, 180, 100, 1, 1);
    const p3ntsc = await getCanvasPixels(page, 270, 100, 1, 1);

    const p1ntscPixel = [p1ntsc.data[0], p1ntsc.data[1], p1ntsc.data[2]];
    const p2ntscPixel = [p2ntsc.data[0], p2ntsc.data[1], p2ntsc.data[2]];
    const p3ntscPixel = [p3ntsc.data[0], p3ntsc.data[1], p3ntsc.data[2]];

    console.log('NTSC pattern 1:', p1ntscPixel);
    console.log('NTSC pattern 2:', p2ntscPixel);
    console.log('NTSC pattern 3:', p3ntscPixel);

    // All should have color in NTSC
    expect(hasColor(p1ntscPixel)).toBe(true);
    expect(hasColor(p2ntscPixel)).toBe(true);
    expect(hasColor(p3ntscPixel)).toBe(true);

    // Switch to Mono
    await selectRenderMode(page, 'mono');
    await page.waitForTimeout(500);
    await takeScreenshot(page, 'multi-patterns-mono.png');

    const p1mono = await getCanvasPixels(page, 90, 100, 1, 1);
    const p2mono = await getCanvasPixels(page, 180, 100, 1, 1);
    const p3mono = await getCanvasPixels(page, 270, 100, 1, 1);

    const p1monoPixel = [p1mono.data[0], p1mono.data[1], p1mono.data[2]];
    const p2monoPixel = [p2mono.data[0], p2mono.data[1], p2mono.data[2]];
    const p3monoPixel = [p3mono.data[0], p3mono.data[1], p3mono.data[2]];

    console.log('Mono pattern 1:', p1monoPixel);
    console.log('Mono pattern 2:', p2monoPixel);
    console.log('Mono pattern 3:', p3monoPixel);

    // All should be grayscale in Mono
    expect(isGrayscale(p1monoPixel)).toBe(true);
    expect(isGrayscale(p2monoPixel)).toBe(true);
    expect(isGrayscale(p3monoPixel)).toBe(true);

    console.log('✓ All patterns show color in RGB/NTSC, grayscale in Mono');
    console.log('=== Test Complete ===');
  });
});
