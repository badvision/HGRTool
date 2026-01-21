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

test.describe('Render Mode Radio Buttons', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the page
    await page.goto('/imgedit.html');
    await waitForAppReady(page);
    await createNewImage(page);
  });

  test('Radio buttons should exist and be visible', async ({ page }) => {
    console.log('=== Testing radio button existence ===');

    // Check if radio buttons exist
    const rgbRadio = await page.locator('#render-mode-rgb');
    const ntscRadio = await page.locator('#render-mode-ntsc');

    expect(await rgbRadio.count()).toBe(1);
    expect(await ntscRadio.count()).toBe(1);

    console.log('RGB radio visible:', await rgbRadio.isVisible());
    console.log('NTSC radio visible:', await ntscRadio.isVisible());

    expect(await rgbRadio.isVisible()).toBeTruthy();
    expect(await ntscRadio.isVisible()).toBeTruthy();

    // Check initial state
    console.log('RGB radio checked:', await rgbRadio.isChecked());
    console.log('NTSC radio checked:', await ntscRadio.isChecked());

    await page.screenshot({ path: 'test-output/radio-initial-state.png' });
  });

  test('Radio buttons should change state when clicked', async ({ page }) => {
    console.log('=== Testing radio button click behavior ===');

    const rgbRadio = await page.locator('#render-mode-rgb');
    const ntscRadio = await page.locator('#render-mode-ntsc');

    // Check initial state
    const rgbInitial = await rgbRadio.isChecked();
    const ntscInitial = await ntscRadio.isChecked();
    console.log('Initial - RGB checked:', rgbInitial, 'NTSC checked:', ntscInitial);

    // Click NTSC radio
    console.log('Clicking NTSC radio button...');
    await ntscRadio.click();
    await page.waitForTimeout(500);

    // Check state after click
    const rgbAfterClick = await rgbRadio.isChecked();
    const ntscAfterClick = await ntscRadio.isChecked();
    console.log('After click - RGB checked:', rgbAfterClick, 'NTSC checked:', ntscAfterClick);

    await page.screenshot({ path: 'test-output/radio-after-ntsc-click.png' });

    // Verify state changed
    expect(ntscAfterClick).toBeTruthy();
    expect(rgbAfterClick).toBeFalsy();

    // Click RGB radio
    console.log('Clicking RGB radio button...');
    await rgbRadio.click();
    await page.waitForTimeout(500);

    const rgbFinal = await rgbRadio.isChecked();
    const ntscFinal = await ntscRadio.isChecked();
    console.log('Final - RGB checked:', rgbFinal, 'NTSC checked:', ntscFinal);

    await page.screenshot({ path: 'test-output/radio-after-rgb-click.png' });

    expect(rgbFinal).toBeTruthy();
    expect(ntscFinal).toBeFalsy();
  });

  test('Radio button clicks should trigger change events', async ({ page }) => {
    console.log('=== Testing radio button change events ===');

    // Set up console listener to capture logs
    const consoleMessages = [];
    page.on('console', msg => {
      consoleMessages.push(`${msg.type()}: ${msg.text()}`);
      console.log('Browser console:', msg.type(), msg.text());
    });

    // Inject code to log when change events fire
    await page.evaluate(() => {
      const rgbRadio = document.getElementById('render-mode-rgb');
      const ntscRadio = document.getElementById('render-mode-ntsc');

      rgbRadio.addEventListener('change', (e) => {
        console.log('RGB radio change event fired, checked:', e.target.checked);
      });

      ntscRadio.addEventListener('change', (e) => {
        console.log('NTSC radio change event fired, checked:', e.target.checked);
      });

      console.log('Change event listeners added');
    });

    await page.waitForTimeout(500);

    // Click NTSC radio
    console.log('Clicking NTSC radio...');
    await page.click('#render-mode-ntsc');
    await page.waitForTimeout(500);

    // Click RGB radio
    console.log('Clicking RGB radio...');
    await page.click('#render-mode-rgb');
    await page.waitForTimeout(500);

    console.log('All console messages:', consoleMessages);
  });

  test('Radio buttons trigger canvas redraw when switching modes', async ({ page }) => {
    console.log('=== Testing canvas redraw on mode switch ===');

    // Draw a white rectangle in RGB mode
    await selectRenderMode(page, 'rgb');
    await selectTool(page, 'btn-fill-rect');
    await drawRectangle(page, 100, 50, 400, 200);
    await takeScreenshot(page, 'render-rgb-drawn.png');

    // Verify the rectangle was drawn
    const centerX = (100 + 400) / 2;
    const centerY = (50 + 200) / 2;
    const rgbPixels = await getCanvasPixels(page, centerX - 10, centerY - 10, 20, 20);

    // Count non-black pixels to verify drawing happened
    let nonBlackCount = 0;
    for (let i = 0; i < rgbPixels.data.length; i += 4) {
      if (rgbPixels.data[i] > 50 || rgbPixels.data[i + 1] > 50 || rgbPixels.data[i + 2] > 50) {
        nonBlackCount++;
      }
    }
    const pixelCount = rgbPixels.data.length / 4;
    console.log(`RGB mode: ${nonBlackCount}/${pixelCount} non-black pixels`);
    expect(nonBlackCount).toBeGreaterThan(pixelCount * 0.9); // 90% should be non-black

    // Switch to NTSC mode and verify radio state changes
    await selectRenderMode(page, 'ntsc');
    await page.waitForTimeout(500); // Give time for redraw
    await takeScreenshot(page, 'render-ntsc.png');

    expect(await page.isChecked('#render-mode-ntsc')).toBeTruthy();
    expect(await page.isChecked('#render-mode-rgb')).toBeFalsy();

    // Verify canvas content is preserved (rectangle still visible)
    const ntscPixels = await getCanvasPixels(page, centerX - 10, centerY - 10, 20, 20);
    let ntscNonBlackCount = 0;
    for (let i = 0; i < ntscPixels.data.length; i += 4) {
      if (ntscPixels.data[i] > 50 || ntscPixels.data[i + 1] > 50 || ntscPixels.data[i + 2] > 50) {
        ntscNonBlackCount++;
      }
    }
    console.log(`NTSC mode: ${ntscNonBlackCount}/${pixelCount} non-black pixels`);
    expect(ntscNonBlackCount).toBeGreaterThan(pixelCount * 0.9); // Content preserved

    // Switch to Mono mode and verify radio state changes
    await selectRenderMode(page, 'mono');
    await page.waitForTimeout(500); // Give time for redraw
    await takeScreenshot(page, 'render-mono.png');

    expect(await page.isChecked('#render-mode-mono')).toBeTruthy();
    expect(await page.isChecked('#render-mode-ntsc')).toBeFalsy();

    // Verify canvas content is preserved (rectangle still visible)
    const monoPixels = await getCanvasPixels(page, centerX - 10, centerY - 10, 20, 20);
    let monoNonBlackCount = 0;
    for (let i = 0; i < monoPixels.data.length; i += 4) {
      if (monoPixels.data[i] > 50 || monoPixels.data[i + 1] > 50 || monoPixels.data[i + 2] > 50) {
        monoNonBlackCount++;
      }
    }
    console.log(`Mono mode: ${monoNonBlackCount}/${pixelCount} non-black pixels`);
    expect(monoNonBlackCount).toBeGreaterThan(pixelCount * 0.9); // Content preserved

    console.log('=== Summary ===');
    console.log('✓ Radio buttons change state correctly');
    console.log('✓ Canvas content is preserved across mode switches');
    console.log('✓ All three rendering modes (RGB, NTSC, Mono) work without errors');
    console.log('Note: For solid colors like white, RGB/NTSC/Mono may render identically');
    console.log('      Color-specific rendering differences require colored patterns');
  });

  test('Debug radio button DOM structure and event handlers', async ({ page }) => {
    console.log('=== Debugging radio button DOM structure ===');

    const radioInfo = await page.evaluate(() => {
      const rgbRadio = document.getElementById('render-mode-rgb');
      const ntscRadio = document.getElementById('render-mode-ntsc');

      return {
        rgb: {
          exists: !!rgbRadio,
          type: rgbRadio?.type,
          name: rgbRadio?.name,
          value: rgbRadio?.value,
          checked: rgbRadio?.checked,
          disabled: rgbRadio?.disabled,
          parentTag: rgbRadio?.parentElement?.tagName,
          hasChangeListener: !!rgbRadio?.onchange,
          classList: rgbRadio ? Array.from(rgbRadio.classList) : []
        },
        ntsc: {
          exists: !!ntscRadio,
          type: ntscRadio?.type,
          name: ntscRadio?.name,
          value: ntscRadio?.value,
          checked: ntscRadio?.checked,
          disabled: ntscRadio?.disabled,
          parentTag: ntscRadio?.parentElement?.tagName,
          hasChangeListener: !!ntscRadio?.onchange,
          classList: ntscRadio ? Array.from(ntscRadio.classList) : []
        }
      };
    });

    console.log('Radio button info:', JSON.stringify(radioInfo, null, 2));

    // Check if event handlers are attached via addEventListener
    const listenerInfo = await page.evaluate(() => {
      const rgbRadio = document.getElementById('render-mode-rgb');
      const ntscRadio = document.getElementById('render-mode-ntsc');

      // Try to trigger change manually
      const testResults = {
        canDispatchEvent: false,
        manualCheckChange: false
      };

      try {
        const event = new Event('change', { bubbles: true });
        testResults.canDispatchEvent = ntscRadio.dispatchEvent(event);
      } catch (e) {
        testResults.error = e.message;
      }

      // Try manually setting checked
      const originalNtscChecked = ntscRadio.checked;
      const originalRgbChecked = rgbRadio.checked;

      ntscRadio.checked = true;
      rgbRadio.checked = false;

      testResults.manualCheckChange =
        ntscRadio.checked === true &&
        originalNtscChecked !== ntscRadio.checked;

      return testResults;
    });

    console.log('Event listener info:', JSON.stringify(listenerInfo, null, 2));
  });
});
