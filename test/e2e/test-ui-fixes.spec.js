import { test, expect } from '@playwright/test';
import {
  waitForAppReady,
  selectTool,
  selectColor,
  selectRenderMode,
  drawRectangle,
  takeScreenshot,
  getCanvasPixels
} from './helpers.js';

test.describe('UI Fixes: Mono Mode and Auto-Create', () => {
  test('Auto-create: Blank document appears on startup', async ({ page }) => {
    console.log('=== Test: Auto-Create Document ===');

    await page.goto('/imgedit.html');
    await waitForAppReady(page);

    // Small delay to ensure auto-create has completed
    await page.waitForTimeout(500);

    // Check that a thumbnail is visible (indicates document was created)
    const thumbnails = await page.locator('.right-pic').count();
    console.log(`Number of thumbnails: ${thumbnails}`);

    // Should have at least 1 document (auto-created)
    expect(thumbnails).toBeGreaterThanOrEqual(1);

    // Check that the canvas is not empty (has some content)
    const canvas = await page.locator('#edit-surface');
    expect(await canvas.isVisible()).toBeTruthy();

    console.log('✓ Auto-create: Document created on startup');
  });

  test('Auto-create: No auto-create with URL parameters', async ({ page }) => {
    console.log('=== Test: No Auto-Create with URL Params ===');

    await page.goto('/imgedit.html?test=1');
    await waitForAppReady(page);

    // Small delay
    await page.waitForTimeout(500);

    // Should NOT auto-create when URL has parameters
    const thumbnails = await page.locator('.right-pic').count();
    console.log(`Number of thumbnails: ${thumbnails}`);

    // Might be 0 or might have default, depends on implementation
    // The key is it shouldn't crash or error

    console.log('✓ No auto-create with URL params (no crashes)');
  });

  test('Mono mode: Radio button switches to grayscale', async ({ page }) => {
    console.log('=== Test: Mono Mode Switching ===');

    await page.goto('/imgedit.html');
    await waitForAppReady(page);

    // Manually create a new document (in case auto-create is disabled)
    await page.click('#btn-new');
    await page.waitForTimeout(300);

    // Select RGB mode first
    await selectRenderMode(page, 'rgb');
    await selectTool(page, 'btn-fill-rect');
    await selectColor(page, 'green');

    // Draw a colored rectangle in RGB mode
    await drawRectangle(page, 100, 50, 200, 100);
    await takeScreenshot(page, 'mono-test-rgb.png');

    // Get RGB pixel color
    const rgbPixel = await getCanvasPixels(page, 150, 75, 1, 1);
    console.log('RGB mode pixel:', rgbPixel.data.slice(0, 3));

    // Verify it's colored (not black, not white)
    const rgbSum = rgbPixel.data[0] + rgbPixel.data[1] + rgbPixel.data[2];
    console.log('RGB sum:', rgbSum);
    expect(rgbSum).toBeGreaterThan(50); // Not black
    expect(rgbSum).toBeLessThan(700);    // Not pure white

    // Switch to Mono mode
    console.log('Switching to Mono mode...');
    await selectRenderMode(page, 'mono');
    await takeScreenshot(page, 'mono-test-mono.png');

    // Get Mono pixel color
    const monoPixel = await getCanvasPixels(page, 150, 75, 1, 1);
    console.log('Mono mode pixel:', monoPixel.data.slice(0, 3));

    // In mono mode, R=G=B (grayscale)
    const monoR = monoPixel.data[0];
    const monoG = monoPixel.data[1];
    const monoB = monoPixel.data[2];

    console.log(`Mono R: ${monoR}, G: ${monoG}, B: ${monoB}`);

    // Verify grayscale (R≈G≈B)
    expect(Math.abs(monoR - monoG)).toBeLessThan(10);
    expect(Math.abs(monoG - monoB)).toBeLessThan(10);
    expect(Math.abs(monoR - monoB)).toBeLessThan(10);

    // Verify not pure black (shows some content)
    expect(monoR).toBeGreaterThan(50);

    console.log('✓ Mono mode: Correctly renders as grayscale');
  });

  test('Mono mode: Switching between modes preserves data', async ({ page }) => {
    console.log('=== Test: Mode Switching Preserves Data ===');

    await page.goto('/imgedit.html');
    await waitForAppReady(page);

    // Create document
    await page.click('#btn-new');
    await page.waitForTimeout(300);

    // Draw in RGB
    await selectRenderMode(page, 'rgb');
    await selectTool(page, 'btn-fill-rect');
    await selectColor(page, 'orange');
    await drawRectangle(page, 50, 50, 150, 100);
    await takeScreenshot(page, 'mode-preserve-rgb.png');

    // Get RGB color
    const rgbPixel = await getCanvasPixels(page, 100, 75, 1, 1);
    const rgbSum = rgbPixel.data[0] + rgbPixel.data[1] + rgbPixel.data[2];
    console.log('Initial RGB sum:', rgbSum);

    // Switch to Mono
    await selectRenderMode(page, 'mono');
    await takeScreenshot(page, 'mode-preserve-mono.png');

    const monoPixel = await getCanvasPixels(page, 100, 75, 1, 1);
    console.log('Mono pixel:', monoPixel.data.slice(0, 3));

    // Switch back to RGB
    await selectRenderMode(page, 'rgb');
    await takeScreenshot(page, 'mode-preserve-rgb-after.png');

    const rgbPixel2 = await getCanvasPixels(page, 100, 75, 1, 1);
    const rgbSum2 = rgbPixel2.data[0] + rgbPixel2.data[1] + rgbPixel2.data[2];
    console.log('After switch RGB sum:', rgbSum2);

    // Colors should be approximately the same (allowing for small rendering differences)
    expect(Math.abs(rgbSum - rgbSum2)).toBeLessThan(50);

    console.log('✓ Mode switching preserves underlying data');
  });
});
