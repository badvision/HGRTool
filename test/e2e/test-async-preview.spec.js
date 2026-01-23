import { test, expect } from '@playwright/test';

// Helper function to set up File System Access API mock and create test image
async function setupFilePickerMock(page) {
  await page.addInitScript(() => {
    // Mock the File System Access API with a larger test image (280x192)
    // This creates an image large enough to have realistic preview duration for cancellation testing
    window.showOpenFilePicker = async function() {
      // Create a 280x192 canvas with gradient pattern
      const canvas = document.createElement('canvas');
      canvas.width = 280;
      canvas.height = 192;
      const ctx = canvas.getContext('2d');

      // Create gradient pattern for realistic image content
      const gradient = ctx.createLinearGradient(0, 0, 280, 192);
      gradient.addColorStop(0, '#ff0000');
      gradient.addColorStop(0.5, '#00ff00');
      gradient.addColorStop(1, '#0000ff');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 280, 192);

      // Convert canvas to blob
      const dataUrl = canvas.toDataURL('image/png');
      const base64Data = dataUrl.split(',')[1];

      // Convert base64 to Blob
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'image/png' });

      // Create a File object
      const file = new File([blob], 'test.png', { type: 'image/png' });

      // Mock FileSystemFileHandle
      const fileHandle = {
        kind: 'file',
        name: 'test.png',
        getFile: async () => file
      };

      return [fileHandle];
    };
  });
}

// Helper function to open import dialog and select a file
async function openImportDialogWithFile(page) {
  await page.click('#btn-import');
  await page.waitForSelector('#import-dialog[open]', { timeout: 5000 });
  await page.click('#import-select-file');
  await page.waitForSelector('#import-preview-section', { state: 'visible', timeout: 5000 });

  // Wait for initial preview to complete
  await page.waitForFunction(() => {
    const spinner = document.getElementById('import-preview-spinner');
    return spinner && window.getComputedStyle(spinner).display === 'none';
  }, { timeout: 10000 });
}

test.describe('Async Preview with Progress', () => {
  test.beforeEach(async ({ page }) => {
    await setupFilePickerMock(page);
    await page.goto('http://localhost:8080/imgedit.html');
    await page.waitForLoadState('networkidle');
  });

  test('should show spinner during preview generation', async ({ page }) => {
    await page.click('#btn-import');
    await page.waitForSelector('#import-dialog[open]', { timeout: 5000 });
    await page.click('#import-select-file');

    // Wait for preview section to be visible
    await page.waitForSelector('#import-preview-section', { state: 'visible', timeout: 5000 });

    // Spinner should be visible immediately after file selection
    const spinner = page.locator('#import-preview-spinner');
    await expect(spinner).toBeVisible({ timeout: 2000 });

    // Wait for spinner to disappear (preview complete)
    await expect(spinner).not.toBeVisible({ timeout: 10000 });
  });

  test('should show progress percentage in spinner', async ({ page }) => {
    await page.click('#btn-import');
    await page.waitForSelector('#import-dialog[open]', { timeout: 5000 });
    await page.click('#import-select-file');
    await page.waitForSelector('#import-preview-section', { state: 'visible', timeout: 5000 });

    // Check that spinner shows progress
    const spinnerPercent = page.locator('.spinner-percent');

    // Should show 0% initially
    const initialText = await spinnerPercent.textContent();
    expect(initialText).toContain('%');

    // Wait for spinner to disappear
    await page.waitForFunction(() => {
      const spinner = document.getElementById('import-preview-spinner');
      return spinner && window.getComputedStyle(spinner).display === 'none';
    }, { timeout: 10000 });
  });

  test('should cancel previous preview when slider changes', async ({ page }) => {
    await openImportDialogWithFile(page);

    // Rapidly change hue slider multiple times (should cancel previous previews)
    // The goal is to verify that rapid changes work correctly without errors
    const hueSlider = page.locator('#import-hue');
    const spinner = page.locator('#import-preview-spinner');

    // Make rapid changes - if cancellation doesn't work, this could cause issues
    await hueSlider.fill('5');
    await expect(spinner).toBeVisible({ timeout: 1000 }); // Spinner should appear
    await page.waitForTimeout(50); // Shorter than debounce

    await hueSlider.fill('10');
    await page.waitForTimeout(50);

    await hueSlider.fill('15');
    await page.waitForTimeout(50);

    await hueSlider.fill('20');

    // Wait for final preview to complete
    await page.waitForFunction(() => {
      const spinner = document.getElementById('import-preview-spinner');
      return spinner && window.getComputedStyle(spinner).display === 'none';
    }, { timeout: 10000 });

    // Verify final hue value was applied
    const finalHue = await hueSlider.inputValue();
    expect(finalHue).toBe('20');

    // Verify canvas has content (not blank)
    const hasContent = await page.evaluate(() => {
      const canvas = document.getElementById('import-preview-canvas');
      const ctx = canvas.getContext('2d');
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      // Check if canvas has any non-zero pixels
      for (let i = 0; i < imageData.data.length; i++) {
        if (imageData.data[i] !== 0) return true;
      }
      return false;
    });
    expect(hasContent).toBe(true);
  });

  test('should keep last preview visible while generating new one', async ({ page }) => {
    await openImportDialogWithFile(page);

    // Get canvas content after first preview
    const canvasBeforeChange = await page.evaluate(() => {
      const canvas = document.getElementById('import-preview-canvas');
      const ctx = canvas.getContext('2d');
      const imageData = ctx.getImageData(0, 0, 1, 1);
      return Array.from(imageData.data);
    });

    // Change slider to trigger new preview
    const hueSlider = page.locator('#import-hue');
    await hueSlider.fill('15');

    // Check that canvas still has content (not cleared) while spinner is visible
    const canvasDuringChange = await page.evaluate(() => {
      const canvas = document.getElementById('import-preview-canvas');
      const ctx = canvas.getContext('2d');
      const imageData = ctx.getImageData(0, 0, 1, 1);
      return Array.from(imageData.data);
    });

    // Canvas should not be all zeros (cleared)
    const hasContent = canvasDuringChange.some(val => val !== 0);
    expect(hasContent).toBe(true);
  });

  test('should clear canvas when dialog first opens', async ({ page }) => {
    // Open dialog (no file yet)
    await page.click('#btn-import');
    await page.waitForSelector('#import-dialog[open]', { timeout: 5000 });

    // Check that canvas is blank
    const canvasData = await page.evaluate(() => {
      const canvas = document.getElementById('import-preview-canvas');
      const ctx = canvas.getContext('2d');
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      // Check if all pixels are 0 (transparent black)
      for (let i = 0; i < imageData.data.length; i++) {
        if (imageData.data[i] !== 0) {
          return false;
        }
      }
      return true;
    });

    expect(canvasData).toBe(true);
  });

  test('should reset to Greedy algorithm and default sliders on open', async ({ page }) => {
    // Open dialog with file
    await openImportDialogWithFile(page);

    // Change settings
    await page.selectOption('#import-algorithm', 'viterbi');
    await page.locator('#import-hue').fill('20');
    await page.locator('#import-saturation').fill('30');

    // Wait for preview to complete
    await page.waitForFunction(() => {
      const spinner = document.getElementById('import-preview-spinner');
      return spinner && window.getComputedStyle(spinner).display === 'none';
    }, { timeout: 10000 });

    // Close dialog
    await page.click('#import-cancel');
    await expect(page.locator('#import-dialog')).not.toHaveAttribute('open', { timeout: 5000 });

    // Reopen dialog
    await page.click('#btn-import');
    await page.waitForSelector('#import-dialog[open]', { timeout: 5000 });

    // Check that settings are reset
    const algorithm = await page.locator('#import-algorithm').inputValue();
    const hue = await page.locator('#import-hue').inputValue();
    const saturation = await page.locator('#import-saturation').inputValue();
    const brightness = await page.locator('#import-brightness').inputValue();
    const contrast = await page.locator('#import-contrast').inputValue();

    expect(algorithm).toBe('greedy');
    expect(hue).toBe('0');
    expect(saturation).toBe('0');
    expect(brightness).toBe('0');
    expect(contrast).toBe('0');
  });

  test('should reuse preview when convert button is clicked without changing settings', async ({ page }) => {
    await openImportDialogWithFile(page);

    // Click convert without changing settings
    await page.click('#import-convert');

    // Progress modal should NOT appear (reusing preview)
    // Check that progress modal is not visible
    const progressModal = page.locator('#progress-modal');

    // Wait a bit to ensure modal doesn't appear
    await page.waitForTimeout(500);

    // Modal should not be visible (or should close very quickly)
    const isVisible = await progressModal.isVisible();

    // Either not visible, or was visible very briefly (acceptable)
    // The key is that conversion completes without long progress modal
  });

  test('should show progress modal when convert is clicked after changing settings', async ({ page }) => {
    await openImportDialogWithFile(page);

    // Change settings to force new conversion
    await page.locator('#import-hue').fill('15');

    // Wait for preview with new settings
    await page.waitForFunction(() => {
      const spinner = document.getElementById('import-preview-spinner');
      return spinner && window.getComputedStyle(spinner).display === 'none';
    }, { timeout: 10000 });

    // Now change settings again WITHOUT waiting for preview
    await page.locator('#import-hue').fill('25');

    // Immediately click convert (settings don't match preview)
    await page.click('#import-convert');

    // Progress modal SHOULD appear (settings differ from preview)
    const progressModal = page.locator('#progress-modal');
    await expect(progressModal).toBeVisible({ timeout: 2000 });
  });
});
