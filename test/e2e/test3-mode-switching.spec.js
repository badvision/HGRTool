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

test.describe('Test 4: Mode Switching', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/imgedit.html');
    await waitForAppReady(page);
    await createNewImage(page);
  });

  test('Pattern persists correctly through mode switches', async ({ page }) => {
    console.log('=== Test: Mode Switching ===');

    // Select rectangle tool
    await selectTool(page, 'btn-fill-rect');

    // Draw pattern in RGB mode
    console.log('Step 1: Drawing in RGB mode');
    await selectRenderMode(page, 'rgb');
    await selectColor(page, 'orange');
    await drawRectangle(page, 50, 50, 150, 100);
    await selectColor(page, 'blue');
    await drawRectangle(page, 160, 50, 260, 100);
    await selectColor(page, 'green');
    await drawRectangle(page, 270, 50, 370, 100);
    await takeScreenshot(page, 'mode-rgb.png');

    // Capture RGB pixels for comparison
    const rgbOrange = await getCanvasPixels(page, 100, 75, 1, 1);
    const rgbBlue = await getCanvasPixels(page, 210, 75, 1, 1);
    const rgbGreen = await getCanvasPixels(page, 320, 75, 1, 1);

    console.log('RGB Orange:', rgbOrange.data.slice(0, 3));
    console.log('RGB Blue:', rgbBlue.data.slice(0, 3));
    console.log('RGB Green:', rgbGreen.data.slice(0, 3));

    // Switch to NTSC mode
    console.log('Step 2: Switching to NTSC mode');
    await selectRenderMode(page, 'ntsc');
    await takeScreenshot(page, 'mode-ntsc.png');

    // Verify colors are still visible in NTSC
    const ntscOrange = await getCanvasPixels(page, 100, 75, 1, 1);
    const ntscBlue = await getCanvasPixels(page, 210, 75, 1, 1);
    const ntscGreen = await getCanvasPixels(page, 320, 75, 1, 1);

    console.log('NTSC Orange:', ntscOrange.data.slice(0, 3));
    console.log('NTSC Blue:', ntscBlue.data.slice(0, 3));
    console.log('NTSC Green:', ntscGreen.data.slice(0, 3));

    // Verify rectangles are still colored (not black)
    expect(ntscOrange.data[0] + ntscOrange.data[1] + ntscOrange.data[2]).toBeGreaterThan(50);
    expect(ntscBlue.data[0] + ntscBlue.data[1] + ntscBlue.data[2]).toBeGreaterThan(50);
    expect(ntscGreen.data[0] + ntscGreen.data[1] + ntscGreen.data[2]).toBeGreaterThan(50);

    // Switch to Mono mode
    console.log('Step 3: Switching to Mono mode');
    await selectRenderMode(page, 'mono');
    await takeScreenshot(page, 'mode-mono.png');

    // Verify pattern is visible in mono (white/black)
    const monoOrange = await getCanvasPixels(page, 100, 75, 1, 1);
    const monoBlue = await getCanvasPixels(page, 210, 75, 1, 1);
    const monoGreen = await getCanvasPixels(page, 320, 75, 1, 1);

    console.log('Mono Orange R:', monoOrange.data[0]);
    console.log('Mono Blue R:', monoBlue.data[0]);
    console.log('Mono Green R:', monoGreen.data[0]);

    // In mono, pixels should be either bright (white) or dark (black)
    // Verify they're not mid-gray (indicates correct rendering)
    expect(monoOrange.data[0]).toBeGreaterThan(100);
    expect(monoBlue.data[0]).toBeGreaterThan(100);
    expect(monoGreen.data[0]).toBeGreaterThan(100);

    // Switch back to RGB mode
    console.log('Step 4: Switching back to RGB mode');
    await selectRenderMode(page, 'rgb');
    await takeScreenshot(page, 'mode-rgb-after.png');

    // Verify colors are restored correctly
    const rgbOrange2 = await getCanvasPixels(page, 100, 75, 1, 1);
    const rgbBlue2 = await getCanvasPixels(page, 210, 75, 1, 1);
    const rgbGreen2 = await getCanvasPixels(page, 320, 75, 1, 1);

    console.log('RGB Orange (after):', rgbOrange2.data.slice(0, 3));
    console.log('RGB Blue (after):', rgbBlue2.data.slice(0, 3));
    console.log('RGB Green (after):', rgbGreen2.data.slice(0, 3));

    // Verify orange rectangle is still orange-ish
    expect(rgbOrange2.data[0]).toBeGreaterThan(150); // Red high
    expect(rgbOrange2.data[2]).toBeLessThan(100);    // Blue low

    // Verify blue rectangle is still blue-ish
    expect(rgbBlue2.data[2]).toBeGreaterThan(150);   // Blue high
    expect(rgbBlue2.data[0]).toBeLessThan(150);      // Red not too high

    // Verify green rectangle is still green-ish
    expect(rgbGreen2.data[1]).toBeGreaterThan(150);  // Green high
    expect(rgbGreen2.data[2]).toBeLessThan(150);     // Blue not too high
  });

  test('Drawing tools respect current render mode', async ({ page }) => {
    console.log('=== Test: Drawing in different modes ===');

    await selectTool(page, 'btn-fill-rect');
    await selectColor(page, 'purple');

    // Draw in RGB mode
    await selectRenderMode(page, 'rgb');
    await drawRectangle(page, 50, 50, 150, 100);
    await takeScreenshot(page, 'drawing-rgb-mode.png');

    const rgbPurple = await getCanvasPixels(page, 100, 75, 1, 1);
    console.log('RGB Purple:', rgbPurple.data.slice(0, 3));

    // Verify purple (high red, low green, high blue)
    expect(rgbPurple.data[0]).toBeGreaterThan(150);  // Red
    expect(rgbPurple.data[1]).toBeLessThan(100);     // Green
    expect(rgbPurple.data[2]).toBeGreaterThan(150);  // Blue

    // Switch to NTSC and draw another rectangle
    await selectRenderMode(page, 'ntsc');
    await selectColor(page, 'orange');
    await drawRectangle(page, 160, 50, 260, 100);
    await takeScreenshot(page, 'drawing-ntsc-mode.png');

    // Verify both rectangles are visible
    const ntscPurple = await getCanvasPixels(page, 100, 75, 1, 1);
    const ntscOrange = await getCanvasPixels(page, 210, 75, 1, 1);

    console.log('NTSC Purple:', ntscPurple.data.slice(0, 3));
    console.log('NTSC Orange:', ntscOrange.data.slice(0, 3));

    expect(ntscPurple.data[0] + ntscPurple.data[1] + ntscPurple.data[2]).toBeGreaterThan(50);
    expect(ntscOrange.data[0] + ntscOrange.data[1] + ntscOrange.data[2]).toBeGreaterThan(50);
  });
});
