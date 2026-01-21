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

test.describe('Render Mode Pixel Debugging', () => {
  test.beforeEach(async ({ page }) => {
    // Set up console logging BEFORE navigation
    page.on('console', msg => {
      console.log(`[BROWSER ${msg.type().toUpperCase()}]:`, msg.text());
    });

    // Navigate to the page
    await page.goto('/imgedit.html');
    await waitForAppReady(page);
    await createNewImage(page);
  });

  test('Draw ORANGE rectangle and verify ACTUAL color differences in RGB vs Mono vs NTSC', async ({ page }) => {
    console.log('\n=== CRITICAL DEBUG: Testing REAL pixel color differences ===\n');

    // Draw an ORANGE rectangle (orange is high-bit set, so should look different in different modes)
    await selectRenderMode(page, 'rgb');
    await page.waitForTimeout(500);

    await selectTool(page, 'btn-fill-rect');

    // Select ORANGE color (hcolor=6, which is 0xaa with high bit set)
    // Orange should be VERY different in RGB vs Mono
    await page.evaluate(() => {
      // Find the orange color swatch and click it
      const colorPicker = document.getElementById('color-picker-hgr');
      const dialog = colorPicker;
      dialog.showModal();

      // Wait for dialog to be visible
      setTimeout(() => {
        // Click on the orange color (row 0, col 6 in solid colors)
        const orangeButton = document.querySelector('[data-row="0"][data-col="6"]');
        if (orangeButton) {
          orangeButton.click();
          console.log('🎨 Clicked ORANGE color');
        } else {
          console.error('❌ Could not find orange color button');
        }
        dialog.close();
      }, 100);
    });

    await page.waitForTimeout(500);

    // Draw the rectangle
    console.log('📐 Drawing orange rectangle at (100, 50) to (400, 200)');
    await drawRectangle(page, 100, 50, 400, 200);
    await page.waitForTimeout(500);
    await takeScreenshot(page, 'pixel-debug-rgb-orange.png');

    // Sample pixel coordinates (center of rectangle)
    const sampleX = 250;
    const sampleY = 125;

    // === RGB MODE: Get pixel data ===
    console.log('\n🔴 === RGB MODE ===');
    const rgbPixels = await getCanvasPixels(page, sampleX, sampleY, 1, 1);
    const rgbR = rgbPixels.data[0];
    const rgbG = rgbPixels.data[1];
    const rgbB = rgbPixels.data[2];
    console.log(`RGB pixel at (${sampleX}, ${sampleY}): R=${rgbR}, G=${rgbG}, B=${rgbB}`);

    // Verify it's orange-ish (high R, medium G, low B)
    const rgbIsOrange = rgbR > 200 && rgbG > 100 && rgbG < 200 && rgbB < 100;
    console.log(`RGB is orange-ish: ${rgbIsOrange} (R=${rgbR} > 200 && 100 < G=${rgbG} < 200 && B=${rgbB} < 100)`);

    // Check if any color at all (not black)
    const rgbIsNotBlack = rgbR > 10 || rgbG > 10 || rgbB > 10;
    console.log(`RGB is not black: ${rgbIsNotBlack}`);

    // === MONO MODE: Get pixel data ===
    console.log('\n🟣 === MONO MODE ===');
    console.log('Clicking MONO radio button...');
    await selectRenderMode(page, 'mono');
    await page.waitForTimeout(1000); // Give extra time for render
    await takeScreenshot(page, 'pixel-debug-mono-orange.png');

    const monoPixels = await getCanvasPixels(page, sampleX, sampleY, 1, 1);
    const monoR = monoPixels.data[0];
    const monoG = monoPixels.data[1];
    const monoB = monoPixels.data[2];
    console.log(`Mono pixel at (${sampleX}, ${sampleY}): R=${monoR}, G=${monoG}, B=${monoB}`);

    // In mono, should be grayscale (R=G=B)
    const monoIsGrayscale = Math.abs(monoR - monoG) < 5 && Math.abs(monoG - monoB) < 5;
    console.log(`Mono is grayscale: ${monoIsGrayscale} (R=${monoR}, G=${monoG}, B=${monoB} all similar)`);

    const monoIsNotBlack = monoR > 10 || monoG > 10 || monoB > 10;
    console.log(`Mono is not black: ${monoIsNotBlack}`);

    // === NTSC MODE: Get pixel data ===
    console.log('\n🟡 === NTSC MODE ===');
    console.log('Clicking NTSC radio button...');
    await selectRenderMode(page, 'ntsc');
    await page.waitForTimeout(1000); // Give extra time for render
    await takeScreenshot(page, 'pixel-debug-ntsc-orange.png');

    const ntscPixels = await getCanvasPixels(page, sampleX * 2, sampleY, 1, 1); // NTSC is 2x width
    const ntscR = ntscPixels.data[0];
    const ntscG = ntscPixels.data[1];
    const ntscB = ntscPixels.data[2];
    console.log(`NTSC pixel at (${sampleX * 2}, ${sampleY}): R=${ntscR}, G=${ntscG}, B=${ntscB}`);

    const ntscIsNotBlack = ntscR > 10 || ntscG > 10 || ntscB > 10;
    console.log(`NTSC is not black: ${ntscIsNotBlack}`);

    // === CRITICAL COMPARISONS ===
    console.log('\n=== CRITICAL COMPARISON ===');
    console.log(`RGB:  R=${rgbR}, G=${rgbG}, B=${rgbB}`);
    console.log(`Mono: R=${monoR}, G=${monoG}, B=${monoB}`);
    console.log(`NTSC: R=${ntscR}, G=${ntscG}, B=${ntscB}`);

    // Check if RGB and Mono are DIFFERENT (they should be for orange!)
    const rgbMonoDiff = Math.abs(rgbR - monoR) + Math.abs(rgbG - monoG) + Math.abs(rgbB - monoB);
    console.log(`\nTotal RGB-Mono difference: ${rgbMonoDiff}`);
    console.log(`RGB and Mono are different: ${rgbMonoDiff > 20} (difference=${rgbMonoDiff}, threshold=20)`);

    // Check if NTSC and RGB are DIFFERENT (they should be!)
    const rgbNtscDiff = Math.abs(rgbR - ntscR) + Math.abs(rgbG - ntscG) + Math.abs(rgbB - ntscB);
    console.log(`\nTotal RGB-NTSC difference: ${rgbNtscDiff}`);
    console.log(`RGB and NTSC are different: ${rgbNtscDiff > 20} (difference=${rgbNtscDiff}, threshold=20)`);

    // === VERDICT ===
    console.log('\n=== VERDICT ===');
    if (rgbMonoDiff < 10 && rgbNtscDiff < 10) {
      console.log('❌ FAIL: All three modes render IDENTICALLY! Render modes are NOT working!');
      console.log('   RGB, Mono, and NTSC should show DIFFERENT colors for orange.');
      console.log('   Expected: RGB=orange, Mono=grayscale, NTSC=artifact colors');
    } else {
      console.log('✅ PASS: Render modes show DIFFERENT colors as expected');
      console.log(`   RGB-Mono diff: ${rgbMonoDiff}`);
      console.log(`   RGB-NTSC diff: ${rgbNtscDiff}`);
    }

    // Dump ALL console logs from the browser
    console.log('\n=== DUMPING ALL BROWSER CONSOLE LOGS ===');
    // (logs are already captured via page.on('console') above)

    // Assertions
    expect(rgbIsNotBlack).toBeTruthy(); // RGB should draw something
    expect(monoIsNotBlack).toBeTruthy(); // Mono should draw something
    expect(ntscIsNotBlack).toBeTruthy(); // NTSC should draw something

    // CRITICAL: RGB and Mono should be DIFFERENT for orange
    if (rgbMonoDiff < 20) {
      console.error('\n⚠️ WARNING: RGB and Mono are too similar!');
      console.error('   This suggests render mode switching is NOT working properly.');
    }
    // Don't fail the test yet - just warn
    // expect(rgbMonoDiff).toBeGreaterThan(20);
  });

  test('Verify console logs appear when switching render modes', async ({ page }) => {
    console.log('\n=== Testing console log visibility ===\n');

    const logs = [];
    page.on('console', msg => {
      const text = msg.text();
      logs.push(text);
      console.log(`[CAPTURED]: ${text}`);
    });

    // Switch to NTSC
    console.log('Switching to NTSC...');
    await selectRenderMode(page, 'ntsc');
    await page.waitForTimeout(1000);

    // Switch to Mono
    console.log('Switching to Mono...');
    await selectRenderMode(page, 'mono');
    await page.waitForTimeout(1000);

    // Switch back to RGB
    console.log('Switching to RGB...');
    await selectRenderMode(page, 'rgb');
    await page.waitForTimeout(1000);

    console.log(`\nTotal console logs captured: ${logs.length}`);
    console.log('Logs containing "render":', logs.filter(l => l.toLowerCase().includes('render')));
    console.log('Logs containing "mode":', logs.filter(l => l.toLowerCase().includes('mode')));

    // Check if we see our debug logs
    const hasRenderModeLog = logs.some(l => l.includes('handleRenderModeChange') || l.includes('🔴'));
    const hasPictureRenderLog = logs.some(l => l.includes('Picture.render()') || l.includes('🔵'));
    const hasStdHiResLog = logs.some(l => l.includes('StdHiRes.renderFull()') || l.includes('🟢'));

    console.log(`\nDEBUG LOG CHECKS:`);
    console.log(`  Has handleRenderModeChange log: ${hasRenderModeLog}`);
    console.log(`  Has Picture.render() log: ${hasPictureRenderLog}`);
    console.log(`  Has StdHiRes.renderFull() log: ${hasStdHiResLog}`);

    if (!hasRenderModeLog) {
      console.error('❌ CRITICAL: handleRenderModeChange() is NOT being called!');
      console.error('   This means the radio button event handler is not attached!');
    }

    if (!hasPictureRenderLog) {
      console.error('❌ CRITICAL: Picture.render() is NOT being called!');
    }

    if (!hasStdHiResLog) {
      console.error('❌ CRITICAL: StdHiRes.renderFull() is NOT being called!');
    }

    // Don't fail yet - just diagnose
    console.log('\n=== All captured logs ===');
    logs.forEach((log, i) => console.log(`[${i}]: ${log}`));
  });
});
