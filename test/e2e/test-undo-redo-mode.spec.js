import { test, expect } from '@playwright/test';
import { waitForAppReady, takeScreenshot, createNewImage, selectTool, selectColor, selectRenderMode, drawRectangle } from './helpers.js';

test.describe('Undo/Redo Mode Preservation', () => {
  test('Undo preserves NTSC render mode', async ({ page }) => {
    console.log('=== Test: Undo preserves NTSC mode ===');

    await page.goto('/imgedit.html');
    await waitForAppReady(page);
    await createNewImage(page);

    // Select NTSC mode
    await selectRenderMode(page, 'ntsc');
    await takeScreenshot(page, 'undo-ntsc-01-mode-selected.png');

    // Draw something
    await selectTool(page, 'btn-fill-rect');
    await selectColor(page, 'orange');
    await drawRectangle(page, 50, 50, 100, 80);
    await takeScreenshot(page, 'undo-ntsc-02-drawn.png');

    // Verify we're still in NTSC mode
    let renderMode = await page.evaluate(() => window.gSettings.renderMode);
    expect(renderMode).toBe('ntsc');

    // Perform undo
    await page.keyboard.press('Meta+z'); // Cmd+Z on Mac (Meta is Command key)
    await page.waitForTimeout(300);
    await takeScreenshot(page, 'undo-ntsc-03-after-undo.png');

    // Verify mode is still NTSC
    renderMode = await page.evaluate(() => window.gSettings.renderMode);
    expect(renderMode).toBe('ntsc');
    console.log('✅ NTSC mode preserved after undo');

    // Verify NTSC radio button is still checked
    const ntscRadio = await page.locator('#render-mode-ntsc');
    await expect(ntscRadio).toBeChecked();
  });

  test('Undo preserves Mono render mode', async ({ page }) => {
    console.log('=== Test: Undo preserves Mono mode ===');

    await page.goto('/imgedit.html');
    await waitForAppReady(page);
    await createNewImage(page);

    // Select Mono mode
    await selectRenderMode(page, 'mono');
    await takeScreenshot(page, 'undo-mono-01-mode-selected.png');

    // Draw something
    await selectTool(page, 'btn-fill-rect');
    await selectColor(page, 'white');
    await drawRectangle(page, 50, 50, 100, 80);
    await takeScreenshot(page, 'undo-mono-02-drawn.png');

    // Verify we're still in Mono mode
    let renderMode = await page.evaluate(() => window.gSettings.renderMode);
    expect(renderMode).toBe('mono');

    // Perform undo
    await page.keyboard.press('Meta+z');
    await page.waitForTimeout(300);
    await takeScreenshot(page, 'undo-mono-03-after-undo.png');

    // Verify mode is still Mono
    renderMode = await page.evaluate(() => window.gSettings.renderMode);
    expect(renderMode).toBe('mono');
    console.log('✅ Mono mode preserved after undo');

    // Verify Mono radio button is still checked
    const monoRadio = await page.locator('#render-mode-mono');
    await expect(monoRadio).toBeChecked();
  });

  test('Redo preserves NTSC render mode', async ({ page }) => {
    console.log('=== Test: Redo preserves NTSC mode ===');

    await page.goto('/imgedit.html');
    await waitForAppReady(page);
    await createNewImage(page);

    // Select NTSC mode and draw
    await selectRenderMode(page, 'ntsc');
    await selectTool(page, 'btn-fill-rect');
    await selectColor(page, 'blue');
    await drawRectangle(page, 60, 60, 110, 90);
    await takeScreenshot(page, 'redo-ntsc-01-drawn.png');

    // Undo
    await page.keyboard.press('Meta+z');
    await page.waitForTimeout(300);
    await takeScreenshot(page, 'redo-ntsc-02-after-undo.png');

    // Verify mode is still NTSC
    let renderMode = await page.evaluate(() => window.gSettings.renderMode);
    expect(renderMode).toBe('ntsc');

    // Redo
    await page.keyboard.press('Meta+Shift+z'); // Cmd+Shift+Z on Mac
    await page.waitForTimeout(300);
    await takeScreenshot(page, 'redo-ntsc-03-after-redo.png');

    // Verify mode is still NTSC
    renderMode = await page.evaluate(() => window.gSettings.renderMode);
    expect(renderMode).toBe('ntsc');
    console.log('✅ NTSC mode preserved after redo');

    // Verify NTSC radio button is still checked
    const ntscRadio = await page.locator('#render-mode-ntsc');
    await expect(ntscRadio).toBeChecked();
  });

  test('Redo preserves Mono render mode', async ({ page }) => {
    console.log('=== Test: Redo preserves Mono mode ===');

    await page.goto('/imgedit.html');
    await waitForAppReady(page);
    await createNewImage(page);

    // Select Mono mode and draw
    await selectRenderMode(page, 'mono');
    await selectTool(page, 'btn-fill-rect');
    await selectColor(page, 'black');
    await drawRectangle(page, 40, 40, 90, 70);
    await takeScreenshot(page, 'redo-mono-01-drawn.png');

    // Undo
    await page.keyboard.press('Meta+z');
    await page.waitForTimeout(300);
    await takeScreenshot(page, 'redo-mono-02-after-undo.png');

    // Verify mode is still Mono
    let renderMode = await page.evaluate(() => window.gSettings.renderMode);
    expect(renderMode).toBe('mono');

    // Redo
    await page.keyboard.press('Meta+Shift+z');
    await page.waitForTimeout(300);
    await takeScreenshot(page, 'redo-mono-03-after-redo.png');

    // Verify mode is still Mono
    renderMode = await page.evaluate(() => window.gSettings.renderMode);
    expect(renderMode).toBe('mono');
    console.log('✅ Mono mode preserved after redo');

    // Verify Mono radio button is still checked
    const monoRadio = await page.locator('#render-mode-mono');
    await expect(monoRadio).toBeChecked();
  });

  test('Undo/Redo still works in RGB mode (backward compatibility)', async ({ page }) => {
    console.log('=== Test: RGB mode backward compatibility ===');

    await page.goto('/imgedit.html');
    await waitForAppReady(page);
    await createNewImage(page);

    // RGB is default, but explicitly select it to be sure
    await selectRenderMode(page, 'rgb');
    await selectTool(page, 'btn-fill-rect');
    await selectColor(page, 'green');
    await drawRectangle(page, 70, 70, 120, 100);
    await takeScreenshot(page, 'undo-rgb-01-drawn.png');

    // Undo
    await page.keyboard.press('Meta+z');
    await page.waitForTimeout(300);
    await takeScreenshot(page, 'undo-rgb-02-after-undo.png');

    // Verify mode is still RGB
    let renderMode = await page.evaluate(() => window.gSettings.renderMode);
    expect(renderMode).toBe('rgb');

    // Redo
    await page.keyboard.press('Meta+Shift+z');
    await page.waitForTimeout(300);
    await takeScreenshot(page, 'undo-rgb-03-after-redo.png');

    // Verify mode is still RGB
    renderMode = await page.evaluate(() => window.gSettings.renderMode);
    expect(renderMode).toBe('rgb');
    console.log('✅ RGB mode still works correctly');
  });

  test('Mode switch after drawing, then undo uses current mode', async ({ page }) => {
    console.log('=== Test: Mode switch then undo uses new mode ===');

    await page.goto('/imgedit.html');
    await waitForAppReady(page);
    await createNewImage(page);

    // Start in RGB mode and draw
    await selectRenderMode(page, 'rgb');
    await selectTool(page, 'btn-fill-rect');
    await selectColor(page, 'purple');
    await drawRectangle(page, 80, 60, 130, 90);
    await takeScreenshot(page, 'mode-switch-01-rgb-drawn.png');

    // Switch to NTSC mode (should re-render existing drawing in NTSC)
    await selectRenderMode(page, 'ntsc');
    await takeScreenshot(page, 'mode-switch-02-ntsc-mode.png');

    // Verify mode switched
    let renderMode = await page.evaluate(() => window.gSettings.renderMode);
    expect(renderMode).toBe('ntsc');

    // Now undo - should render in current mode (NTSC), not original mode (RGB)
    await page.keyboard.press('Meta+z');
    await page.waitForTimeout(300);
    await takeScreenshot(page, 'mode-switch-03-undo-in-ntsc.png');

    // Verify we're still in NTSC mode
    renderMode = await page.evaluate(() => window.gSettings.renderMode);
    expect(renderMode).toBe('ntsc');
    console.log('✅ Undo uses current mode (NTSC) not original mode (RGB)');
  });
});
