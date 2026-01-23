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

test.describe('Import Dialog Conversion Bug', () => {
  test.beforeEach(async ({ page }) => {
    // Set up console log monitoring
    page.on('console', msg => {
      console.log('BROWSER:', msg.text());
    });

    // Set up File System Access API mock before page loads
    await setupFilePickerMock(page);

    await page.goto('http://localhost:8080/imgedit.html');
    await page.waitForLoadState('networkidle');
  });

  test('should complete conversion without freezing progress modal', async ({ page }) => {
    // Open dialog and select file
    await openImportDialogWithFile(page);

    // Click convert button
    await page.click('#import-convert');

    // Wait for progress modal to appear
    const progressModal = page.locator('#progress-modal');
    await expect(progressModal).toHaveAttribute('open', '', { timeout: 5000 });

    // Wait for conversion to complete (up to 10 seconds)
    await page.waitForFunction(() => {
      const modal = document.getElementById('progress-modal');
      return !modal.hasAttribute('open');
    }, { timeout: 10000 });

    // Progress modal should be hidden
    await expect(progressModal).not.toHaveAttribute('open');

    // Import dialog should also be closed
    const importDialog = page.locator('#import-dialog');
    await expect(importDialog).not.toHaveAttribute('open');
  });

  test('should not show "Import dialog closed during conversion" error', async ({ page }) => {
    const consoleMessages = [];
    page.on('console', msg => {
      consoleMessages.push(msg.text());
    });

    // Open dialog and select file
    await openImportDialogWithFile(page);

    // Click convert button
    await page.click('#import-convert');

    // Wait for conversion to complete
    await page.waitForTimeout(3000);

    // Check that we didn't get the error message
    const hasError = consoleMessages.some(msg =>
      msg.includes('Import dialog closed during conversion')
    );
    expect(hasError).toBe(false);
  });

  test('should create image in editor after conversion', async ({ page }) => {
    // Open dialog and select file
    await openImportDialogWithFile(page);

    // Click convert button
    await page.click('#import-convert');

    // Wait for progress modal to close (indicates conversion complete)
    await page.waitForFunction(() => {
      const modal = document.getElementById('progress-modal');
      return !modal.hasAttribute('open');
    }, { timeout: 10000 });

    // Give it a moment for the picture to be added to the editor
    await page.waitForTimeout(500);

    // Check that the edit surface canvas exists (this is where images are rendered)
    const canvasExists = await page.evaluate(() => {
      const canvas = document.querySelector('#edit-surface');
      return canvas !== null;
    });

    expect(canvasExists).toBe(true);
  });
});
