import { test } from '@playwright/test';
import {
  waitForAppReady,
  selectTool,
  selectColor,
  takeScreenshot,
  createNewImage
} from './helpers.js';

test.describe('Debug Rectangle Drawing', () => {
  test('Simple rectangle draw test', async ({ page }) => {
    await page.goto('/imgedit.html');
    await waitForAppReady(page);
    await createNewImage(page);

    // Select rectangle tool
    await selectTool(page, 'btn-fill-rect');

    // Select orange color
    await selectColor(page, 'orange');

    // Take screenshot after color selection
    await takeScreenshot(page, 'debug-after-color-selection.png');

    console.log('About to draw rectangle');

    // Get canvas info
    const canvas = await page.locator('#edit-surface');
    const box = await canvas.boundingBox();
    console.log('Canvas box:', JSON.stringify(box));

    // Draw a large rectangle to make it obvious
    // Try drawing from corner (100, 50) to (400, 200) in canvas pixels
    const x1 = 100, y1 = 50, x2 = 400, y2 = 200;

    await page.mouse.move(box.x + x1, box.y + y1);
    await page.waitForTimeout(500);
    console.log('Mouse at start position');

    await page.mouse.down();
    await page.waitForTimeout(500);
    console.log('Mouse down');

    // Move with steps
    for (let step = 1; step <= 5; step++) {
      const t = step / 5;
      const x = box.x + x1 + (x2 - x1) * t;
      const y = box.y + y1 + (y2 - y1) * t;
      await page.mouse.move(x, y);
      await page.waitForTimeout(100);
      console.log(`Mouse moved to step ${step}/5: (${x}, ${y})`);
    }

    await page.mouse.up();
    await page.waitForTimeout(500);
    console.log('Mouse up');

    // Take screenshot
    await takeScreenshot(page, 'debug-rectangle.png');

    // Get the dimensions shown
    const rectWidth = await page.locator('#rect-width').textContent();
    const rectHeight = await page.locator('#rect-height').textContent();
    console.log(`Displayed dimensions: ${rectWidth}x${rectHeight}`);
  });
});
