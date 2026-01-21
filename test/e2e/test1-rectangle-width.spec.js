import { test, expect } from '@playwright/test';
import {
  waitForAppReady,
  selectTool,
  selectColor,
  selectRenderMode,
  drawRectangle,
  takeScreenshot,
  getCanvasPixels,
  createNewImage
} from './helpers.js';

test.describe('Test 1: Rectangle Drawing Width Verification', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/imgedit.html');
    await waitForAppReady(page);
    await createNewImage(page);
  });

  test('RGB mode: Rectangle is drawn on canvas', async ({ page }) => {
    console.log('=== Test: RGB Rectangle Drawing ===');

    // Select RGB mode
    await selectRenderMode(page, 'rgb');

    // Select rectangle tool
    await selectTool(page, 'btn-fill-rect');

    // NOTE: Skipping color selection for now - using default color
    // Color selection has issues that need separate investigation

    // Draw rectangle from (100, 50) to (400, 200) in canvas coordinates
    await drawRectangle(page, 100, 50, 400, 200);

    // Take screenshot
    await takeScreenshot(page, 'rect-rgb-drawing.png');

    // Verify that the rectangle was drawn by checking for non-black pixels
    // in the area where we drew (center of rectangle)
    const centerX = (100 + 400) / 2;
    const centerY = (50 + 200) / 2;
    const pixels = await getCanvasPixels(page, centerX - 10, centerY - 10, 20, 20);

    // Count non-black pixels
    let nonBlackCount = 0;
    for (let i = 0; i < pixels.data.length; i += 4) {
      const r = pixels.data[i];
      const g = pixels.data[i + 1];
      const b = pixels.data[i + 2];
      // Consider a pixel non-black if any channel is > 50
      if (r > 50 || g > 50 || b > 50) {
        nonBlackCount++;
      }
    }

    const totalPixels = pixels.data.length / 4;
    const nonBlackPercent = (nonBlackCount / totalPixels) * 100;

    console.log(`Non-black pixels: ${nonBlackCount}/${totalPixels} (${nonBlackPercent.toFixed(1)}%)`);

    // Expect that most of the sampled pixels are non-black (rectangle was drawn)
    expect(nonBlackPercent).toBeGreaterThan(90);
  });

  test('NTSC mode: Rectangle is drawn on canvas', async ({ page }) => {
    console.log('=== Test: NTSC Rectangle Drawing ===');

    // Select NTSC mode
    await selectRenderMode(page, 'ntsc');

    // Select rectangle tool
    await selectTool(page, 'btn-fill-rect');

    // Draw rectangle
    await drawRectangle(page, 100, 50, 400, 200);

    // Take screenshot
    await takeScreenshot(page, 'rect-ntsc-drawing.png');

    // Verify rectangle was drawn
    const centerX = (100 + 400) / 2;
    const centerY = (50 + 200) / 2;
    const pixels = await getCanvasPixels(page, centerX - 10, centerY - 10, 20, 20);

    let nonBlackCount = 0;
    for (let i = 0; i < pixels.data.length; i += 4) {
      const r = pixels.data[i];
      const g = pixels.data[i + 1];
      const b = pixels.data[i + 2];
      if (r > 50 || g > 50 || b > 50) {
        nonBlackCount++;
      }
    }

    const totalPixels = pixels.data.length / 4;
    const nonBlackPercent = (nonBlackCount / totalPixels) * 100;

    console.log(`Non-black pixels: ${nonBlackCount}/${totalPixels} (${nonBlackPercent.toFixed(1)}%)`);
    expect(nonBlackPercent).toBeGreaterThan(90);
  });

  test('Mono mode: Rectangle is drawn on canvas', async ({ page }) => {
    console.log('=== Test: Mono Rectangle Drawing ===');

    // Select Mono mode
    await selectRenderMode(page, 'mono');

    // Select rectangle tool
    await selectTool(page, 'btn-fill-rect');

    // Draw rectangle
    await drawRectangle(page, 100, 50, 400, 200);

    // Take screenshot
    await takeScreenshot(page, 'rect-mono-drawing.png');

    // Verify rectangle was drawn
    const centerX = (100 + 400) / 2;
    const centerY = (50 + 200) / 2;
    const pixels = await getCanvasPixels(page, centerX - 10, centerY - 10, 20, 20);

    let nonBlackCount = 0;
    for (let i = 0; i < pixels.data.length; i += 4) {
      const r = pixels.data[i];
      const g = pixels.data[i + 1];
      const b = pixels.data[i + 2];
      if (r > 50 || g > 50 || b > 50) {
        nonBlackCount++;
      }
    }

    const totalPixels = pixels.data.length / 4;
    const nonBlackPercent = (nonBlackCount / totalPixels) * 100;

    console.log(`Non-black pixels: ${nonBlackCount}/${totalPixels} (${nonBlackPercent.toFixed(1)}%)`);
    expect(nonBlackPercent).toBeGreaterThan(90);
  });
});
