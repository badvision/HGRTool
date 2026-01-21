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

test.describe('Test 2: Color Palette Accuracy', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/imgedit.html');
    await waitForAppReady(page);
    await createNewImage(page);
  });

  test('All HGR colors render correctly', async ({ page }) => {
    console.log('=== Test: Color Palette Accuracy ===');

    // Select RGB mode for consistent color testing
    await selectRenderMode(page, 'rgb');

    // Select rectangle tool
    await selectTool(page, 'btn-fill-rect');

    // Define colors to test with expected RGB ranges
    const colors = [
      { name: 'black', rgb: { r: [0, 50], g: [0, 50], b: [0, 50] } },
      { name: 'white', rgb: { r: [200, 255], g: [200, 255], b: [200, 255] } },
      { name: 'orange', rgb: { r: [200, 255], g: [100, 180], b: [0, 50] } },
      { name: 'blue', rgb: { r: [0, 100], g: [0, 150], b: [200, 255] } },
      { name: 'green', rgb: { r: [0, 150], g: [200, 255], b: [0, 100] } },
      { name: 'purple', rgb: { r: [180, 255], g: [0, 100], b: [180, 255] } },
    ];

    let yPosition = 50;
    const swatchWidth = 80;
    const swatchHeight = 40;
    const spacing = 10;

    // Draw a swatch for each color
    for (const color of colors) {
      console.log(`Drawing ${color.name} swatch`);

      // Select color
      await selectColor(page, color.name);

      // Draw small rectangle
      await drawRectangle(
        page,
        50,
        yPosition,
        50 + swatchWidth,
        yPosition + swatchHeight
      );

      yPosition += swatchHeight + spacing;
    }

    // Take screenshot of all swatches
    await takeScreenshot(page, 'color-accuracy.png');

    // Verify each color by sampling pixels
    yPosition = 50;
    for (const color of colors) {
      console.log(`Verifying ${color.name} color`);

      // Sample center of swatch
      const centerX = 50 + swatchWidth / 2;
      const centerY = yPosition + swatchHeight / 2;

      const pixels = await getCanvasPixels(page, centerX, centerY, 5, 5);

      // Check first pixel
      const r = pixels.data[0];
      const g = pixels.data[1];
      const b = pixels.data[2];

      console.log(`${color.name}: RGB(${r}, ${g}, ${b})`);

      // Verify color is in expected range
      expect(r).toBeGreaterThanOrEqual(color.rgb.r[0]);
      expect(r).toBeLessThanOrEqual(color.rgb.r[1]);
      expect(g).toBeGreaterThanOrEqual(color.rgb.g[0]);
      expect(g).toBeLessThanOrEqual(color.rgb.g[1]);
      expect(b).toBeGreaterThanOrEqual(color.rgb.b[0]);
      expect(b).toBeLessThanOrEqual(color.rgb.b[1]);

      yPosition += swatchHeight + spacing;
    }
  });

  test('Color consistency across render modes', async ({ page }) => {
    console.log('=== Test: Color Consistency Across Modes ===');

    // Select rectangle tool and orange color
    await selectTool(page, 'btn-fill-rect');
    await selectColor(page, 'orange');

    // Draw in RGB mode
    await selectRenderMode(page, 'rgb');
    await drawRectangle(page, 50, 50, 150, 100);
    const rgbPixels = await getCanvasPixels(page, 100, 75, 1, 1);
    await takeScreenshot(page, 'color-consistency-rgb.png');

    // Switch to NTSC mode
    await selectRenderMode(page, 'ntsc');
    const ntscPixels = await getCanvasPixels(page, 100, 75, 1, 1);
    await takeScreenshot(page, 'color-consistency-ntsc.png');

    // Verify that the rectangle still exists (pixels are not black)
    const ntscR = ntscPixels.data[0];
    const ntscG = ntscPixels.data[1];
    const ntscB = ntscPixels.data[2];

    console.log(`NTSC pixel: RGB(${ntscR}, ${ntscG}, ${ntscB})`);

    // NTSC should show some color (not pure black)
    expect(ntscR + ntscG + ntscB).toBeGreaterThan(50);

    // Switch to Mono mode
    await selectRenderMode(page, 'mono');
    const monoPixels = await getCanvasPixels(page, 100, 75, 1, 1);
    await takeScreenshot(page, 'color-consistency-mono.png');

    // Verify rectangle still exists in mono
    const monoR = monoPixels.data[0];
    console.log(`Mono pixel: R=${monoR}`);

    // Mono should show white or black (not pure black if orange was drawn)
    expect(monoR).toBeGreaterThan(50);
  });
});
