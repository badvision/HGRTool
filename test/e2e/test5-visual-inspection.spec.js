import { test, expect } from '@playwright/test';
import {
  waitForAppReady,
  selectTool,
  selectColor,
  selectRenderMode,
  drawRectangle,
  takeScreenshot,
  createNewImage
} from './helpers.js';

test.describe('Test 5: Visual Inspection Suite', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/imgedit.html');
    await waitForAppReady(page);
    await createNewImage(page);
  });

  test('Comprehensive drawing test for visual inspection', async ({ page }) => {
    console.log('=== Test: Comprehensive Visual Inspection ===');

    // Test in RGB mode first
    await selectRenderMode(page, 'rgb');
    await selectTool(page, 'btn-fill-rect');

    // Draw a grid pattern with all colors
    const colors = ['orange', 'blue', 'green', 'purple', 'white'];
    let x = 20;
    const y = 20;
    const size = 60;
    const gap = 10;

    console.log('Drawing color grid...');
    for (const color of colors) {
      await selectColor(page, color);
      await drawRectangle(page, x, y, x + size, y + size);
      x += size + gap;
    }

    await takeScreenshot(page, 'visual-grid-rgb.png');

    // Test line drawing
    console.log('Drawing lines...');
    await selectTool(page, 'btn-line');
    await selectColor(page, 'orange');

    // Draw diagonal lines
    const lineCanvas = await page.locator('#edit-surface');
    const box = await lineCanvas.boundingBox();

    await page.mouse.move(box.x + 50, box.y + 120);
    await page.mouse.down();
    await page.mouse.move(box.x + 350, box.y + 120);
    await page.mouse.up();

    await selectColor(page, 'blue');
    await page.mouse.move(box.x + 50, box.y + 140);
    await page.mouse.down();
    await page.mouse.move(box.x + 350, box.y + 140);
    await page.mouse.up();

    await takeScreenshot(page, 'visual-lines-rgb.png');

    // Test ellipse drawing
    console.log('Drawing ellipses...');
    await selectTool(page, 'btn-fill-ellipse');
    await selectColor(page, 'green');
    await drawRectangle(page, 50, 170, 130, 230);

    await selectColor(page, 'purple');
    await drawRectangle(page, 150, 170, 230, 230);

    await takeScreenshot(page, 'visual-shapes-rgb.png');

    // Now test in NTSC mode
    console.log('Switching to NTSC mode...');
    await selectRenderMode(page, 'ntsc');
    await takeScreenshot(page, 'visual-comprehensive-ntsc.png');

    // Test in Mono mode
    console.log('Switching to Mono mode...');
    await selectRenderMode(page, 'mono');
    await takeScreenshot(page, 'visual-comprehensive-mono.png');

    // Switch back to RGB for comparison
    await selectRenderMode(page, 'rgb');
    await takeScreenshot(page, 'visual-comprehensive-rgb-final.png');
  });

  test('Scribble tool test', async ({ page }) => {
    console.log('=== Test: Scribble Tool ===');

    await selectRenderMode(page, 'rgb');
    await selectTool(page, 'btn-scribble');
    await selectColor(page, 'orange');

    const canvas = await page.locator('#edit-surface');
    const box = await canvas.boundingBox();

    // Draw a scribble pattern
    await page.mouse.move(box.x + 100, box.y + 100);
    await page.mouse.down();

    // Draw a spiral
    for (let i = 0; i < 50; i++) {
      const angle = i * 0.3;
      const radius = i * 2;
      const x = box.x + 100 + radius * Math.cos(angle);
      const y = box.y + 100 + radius * Math.sin(angle);
      await page.mouse.move(x, y);
    }

    await page.mouse.up();
    await takeScreenshot(page, 'visual-scribble-rgb.png');

    // Test in NTSC
    await selectRenderMode(page, 'ntsc');
    await takeScreenshot(page, 'visual-scribble-ntsc.png');
  });

  test('Stroke (outline) shapes test', async ({ page }) => {
    console.log('=== Test: Stroke Shapes ===');

    await selectRenderMode(page, 'rgb');
    await selectTool(page, 'btn-stroke-rect');
    await selectColor(page, 'orange');

    // Draw outlined rectangles
    await drawRectangle(page, 50, 50, 150, 150);

    await selectTool(page, 'btn-stroke-ellipse');
    await selectColor(page, 'blue');
    await drawRectangle(page, 180, 50, 280, 150);

    await takeScreenshot(page, 'visual-stroke-shapes-rgb.png');

    await selectRenderMode(page, 'ntsc');
    await takeScreenshot(page, 'visual-stroke-shapes-ntsc.png');
  });
});
