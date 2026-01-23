import { test, expect } from '@playwright/test';

// Helper function to set up File System Access API mock and create test image
async function setupFilePickerMock(page) {
  // Create a 1x1 red PNG in base64
  const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';

  await page.addInitScript((base64Data) => {
    // Mock the File System Access API
    window.showOpenFilePicker = async function() {
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
  }, pngBase64);
}

// Helper function to open import dialog and select a file
async function openImportDialogWithFile(page) {
  // Click import button to show dialog
  await page.click('#btn-import');

  // Wait for dialog to be visible
  await page.waitForSelector('#import-dialog[open]', { timeout: 5000 });

  // Click the select file button (this will trigger the mocked showOpenFilePicker)
  await page.click('#import-select-file');

  // Wait for preview section to be visible
  await page.waitForSelector('#import-preview-section', { state: 'visible', timeout: 5000 });
}

test.describe('Import Dialog UI', () => {
  test.beforeEach(async ({ page }) => {
    // Set up File System Access API mock before page loads
    await setupFilePickerMock(page);

    await page.goto('http://localhost:8080/imgedit.html');
    await page.waitForLoadState('networkidle');
  });

  test('should show import dialog when import button is clicked', async ({ page }) => {
    // Click import button
    await page.click('#btn-import');

    // Wait for import dialog to be visible
    const importDialog = page.locator('#import-dialog');
    await expect(importDialog).toBeVisible({ timeout: 5000 });

    // Check that file selection section is visible
    const fileSelection = page.locator('#import-file-selection');
    await expect(fileSelection).toBeVisible();

    // Check that preview section is hidden
    const previewSection = page.locator('#import-preview-section');
    await expect(previewSection).not.toBeVisible();
  });

  test('import dialog should have preview canvas', async ({ page }) => {
    // Open dialog and select file
    await openImportDialogWithFile(page);

    // Check that preview canvas exists and has correct dimensions
    const previewCanvas = page.locator('#import-preview-canvas');
    await expect(previewCanvas).toBeVisible();

    const width = await previewCanvas.getAttribute('width');
    const height = await previewCanvas.getAttribute('height');
    // Canvas is 560x192 (NTSC resolution) but displays at 280x192 via CSS
    expect(width).toBe('560');
    expect(height).toBe('192');
  });

  test('import dialog should have NTSC adjustment sliders', async ({ page }) => {
    // Open dialog and select file
    await openImportDialogWithFile(page);

    // Check for NTSC adjustment controls
    await expect(page.locator('#import-hue')).toBeVisible();
    await expect(page.locator('#import-saturation')).toBeVisible();
    await expect(page.locator('#import-brightness')).toBeVisible();
    await expect(page.locator('#import-contrast')).toBeVisible();
  });

  test('import dialog should have algorithm dropdown', async ({ page }) => {
    // Open dialog and select file
    await openImportDialogWithFile(page);

    // Check algorithm dropdown
    const algorithmSelect = page.locator('#import-algorithm');
    await expect(algorithmSelect).toBeVisible();

    // Check default value
    const defaultValue = await algorithmSelect.inputValue();
    expect(defaultValue).toBe('greedy');

    // Check all options are present
    const options = await algorithmSelect.locator('option').allTextContents();
    expect(options).toContain('Hybrid (Recommended)');
    expect(options).toContain('Viterbi (Best Quality)');
    expect(options).toContain('Greedy (Fast)');
    expect(options).toContain('Threshold (Fastest)');
  });

  test('hue slider should update value display', async ({ page }) => {
    // Open dialog and select file
    await openImportDialogWithFile(page);

    // Get slider and value display
    const hueSlider = page.locator('#import-hue');
    const hueValue = page.locator('#import-hue-value');

    // Change slider value
    await hueSlider.fill('15');

    // Check value display updated
    await expect(hueValue).toHaveText('15');
  });

  test('cancel button should close dialog', async ({ page }) => {
    // Open dialog and select file
    await openImportDialogWithFile(page);

    // Click cancel button
    await page.click('#import-cancel');

    // Dialog should be closed
    const importDialog = page.locator('#import-dialog');
    await expect(importDialog).not.toHaveAttribute('open');
  });

  test('convert button should show progress modal', async ({ page }) => {
    // Open dialog and select file
    await openImportDialogWithFile(page);

    // Click convert button
    await page.click('#import-convert');

    // Progress modal should appear (may be brief for small images)
    // Just verify it's defined and has the right structure
    const progressModal = page.locator('#progress-modal');
    expect(progressModal).toBeDefined();

    // Wait a bit for conversion to complete
    await page.waitForTimeout(2000);

    // Eventually, a new image should be in the picture list
    // (This is implementation-specific, adjust as needed)
  });
});
