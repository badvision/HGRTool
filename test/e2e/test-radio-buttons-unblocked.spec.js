import { test, expect } from '@playwright/test';

test.describe('Radio Buttons Work When Unblocked', () => {
  test('Radio buttons change rendering mode when NOT blocked by dialog', async ({ page }) => {
    console.log('=== Testing radio buttons WITHOUT dialog blocking ===');

    await page.goto('http://localhost:8080/imgedit.html');
    await page.waitForLoadState('networkidle');

    // Take initial screenshot
    await page.screenshot({ path: 'test-output/unblocked-01-initial.png' });

    // Draw a simple colored rectangle WITHOUT opening color picker
    console.log('Drawing with default tool color...');

    // Just draw with whatever color is default
    await page.click('#btn-fill-rect');
    await page.waitForTimeout(300);

    const canvas = await page.locator('#edit-surface');
    const box = await canvas.boundingBox();

    await page.mouse.move(box.x + 50, box.y + 50);
    await page.mouse.down();
    await page.mouse.move(box.x + 150, box.y + 100);
    await page.mouse.up();
    await page.waitForTimeout(500);

    await page.screenshot({ path: 'test-output/unblocked-02-drawn.png' });

    // Now try to click radio buttons (should work since no dialog is open)
    console.log('Clicking NTSC radio button...');

    const rgbChecked = await page.isChecked('#render-mode-rgb');
    const ntscChecked = await page.isChecked('#render-mode-ntsc');
    console.log('Before click - RGB:', rgbChecked, 'NTSC:', ntscChecked);

    // This should work because nothing is blocking
    await page.click('#render-mode-ntsc', { timeout: 5000 });
    await page.waitForTimeout(500);

    await page.screenshot({ path: 'test-output/unblocked-03-ntsc-clicked.png' });

    const rgbAfter = await page.isChecked('#render-mode-rgb');
    const ntscAfter = await page.isChecked('#render-mode-ntsc');
    console.log('After click - RGB:', rgbAfter, 'NTSC:', ntscAfter);

    // Verify state changed
    expect(ntscAfter).toBeTruthy();
    expect(rgbAfter).toBeFalsy();

    console.log('✓ Radio buttons work when NOT blocked by dialog');
  });

  test('Color picker dialog blocks radio buttons', async ({ page }) => {
    console.log('=== Demonstrating that color picker BLOCKS radio buttons ===');

    await page.goto('http://localhost:8080/imgedit.html');
    await page.waitForLoadState('networkidle');

    // Open color picker
    console.log('Opening color picker...');
    await page.click('#btn-choose-color');
    await page.waitForTimeout(500);

    await page.screenshot({ path: 'test-output/blocked-01-picker-open.png' });

    // Try to click NTSC radio button (should fail or timeout)
    console.log('Trying to click NTSC radio button while dialog is open...');

    const clickPromise = page.click('#render-mode-ntsc', { timeout: 5000 });

    // Expect this to fail because dialog is blocking
    await expect(clickPromise).rejects.toThrow();

    console.log('✓ Confirmed: Color picker dialog blocks radio buttons');

    // Clean up - close the dialog
    await page.click('#color-picker-hgr button:has-text("Close")');
    await page.waitForTimeout(300);

    // Now it should work
    console.log('After closing dialog, trying to click NTSC radio...');
    await page.click('#render-mode-ntsc', { timeout: 5000 });
    await page.waitForTimeout(500);

    const ntscChecked = await page.isChecked('#render-mode-ntsc');
    expect(ntscChecked).toBeTruthy();

    console.log('✓ Radio buttons work after dialog is closed');

    await page.screenshot({ path: 'test-output/blocked-02-after-close.png' });
  });
});
