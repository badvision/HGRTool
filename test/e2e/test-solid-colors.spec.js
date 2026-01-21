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
 * Helper to select a solid color from the color picker
 */
async function selectSolidColor(page, colorIndex) {
  console.log(`Selecting solid color: ${colorIndex}`);

  await page.click('#btn-choose-color');
  await page.waitForSelector('#color-picker-hgr[open]', { state: 'visible' });

  const solidCount = await page.locator('#hgr-color-body .swatch-button').count();
  console.log(`Total solid colors available: ${solidCount}`);

  if (colorIndex >= solidCount) {
    throw new Error(`Color index ${colorIndex} out of bounds (max: ${solidCount - 1})`);
  }

  const selector = `#hgr-color-body .swatch-button:nth-child(${colorIndex + 1})`;
  await page.click(selector);

  const dialogOpen = await page.isVisible('#color-picker-hgr[open]');
  if (dialogOpen) {
    await page.click('#hgr-picker-close');
  }

  await page.waitForTimeout(200);
}

test.describe('NTSC Solid Color Rendering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/imgedit.html');
    await waitForAppReady(page);
    await createNewImage(page);
  });

  test('Verify solid colors (green, orange, purple, blue) still render correctly', async ({ page }) => {
    console.log('=== Test: Solid Color Rendering ===');
    console.log('Verifying that fix does not break normal color rendering');

    await selectRenderMode(page, 'ntsc');
    await selectTool(page, 'btn-fill-rect');

    // Draw solid color rectangles
    // Based on getSolidPatterns(): 0=black, 1=purple, 2=green, 3=white, 4=black-hi, 5=blue, 6=orange, 7=white-hi
    const colors = [
      { idx: 1, name: 'purple', x: 20, y: 20 },
      { idx: 2, name: 'green', x: 90, y: 20 },
      { idx: 5, name: 'blue', x: 160, y: 20 },
      { idx: 6, name: 'orange', x: 230, y: 20 }
    ];

    for (const color of colors) {
      console.log(`Drawing ${color.name} at (${color.x}, ${color.y})`);
      await selectSolidColor(page, color.idx);
      await drawRectangle(page, color.x, color.y, color.x + 60, color.y + 60);
    }

    await takeScreenshot(page, 'solid-colors-ntsc.png');

    // Analyze each color
    const results = [];
    for (const color of colors) {
      const sampleX = color.x + 30;
      const sampleY = color.y + 30;
      const pixels = await getCanvasPixels(page, sampleX, sampleY, 10, 10);

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
      const variance = Math.abs(avgR - avgG) + Math.abs(avgG - avgB) + Math.abs(avgB - avgR);

      results.push({ ...color, avgR, avgG, avgB, variance });

      console.log(`${color.name}: RGB=(${avgR.toFixed(1)}, ${avgG.toFixed(1)}, ${avgB.toFixed(1)}), variance=${variance.toFixed(1)}`);
    }

    // Verify colors are distinct (not all grayscale)
    const allGrayscale = results.every(r => r.variance < 30);

    console.log('\n=== RESULTS ===');
    if (allGrayscale) {
      console.log('✗ FAIL: All colors are grayscale - fix broke color rendering!');
      console.log('   This means high-frequency fix is too aggressive.');
    } else {
      console.log('✓ PASS: Colors show color artifacts as expected');
      console.log('   High-frequency fix does not break normal color rendering.');
    }

    expect(allGrayscale).toBe(false);

    // Specifically check that green and orange have color
    const green = results.find(r => r.name === 'green');
    const orange = results.find(r => r.name === 'orange');

    console.log(`\nGreen has color: ${green.variance > 30 ? 'YES' : 'NO'}`);
    console.log(`Orange has color: ${orange.variance > 30 ? 'YES' : 'NO'}`);

    expect(green.variance).toBeGreaterThan(30);
    expect(orange.variance).toBeGreaterThan(30);
  });
});
