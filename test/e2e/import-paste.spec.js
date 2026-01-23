import { test, expect } from '@playwright/test';

// Helper function to create a test PNG file as base64
function createTestPNG() {
    // 1x1 red PNG
    return 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
}

test.describe('Import Dialog Clipboard Paste', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:8080/imgedit.html');
        await page.waitForLoadState('networkidle');
    });

    test('should handle paste event when dialog is open', async ({ page }) => {
        // Click import button
        await page.click('#btn-import');
        await page.waitForSelector('#import-dialog[open]', { timeout: 5000 });

        // Create and paste an image
        const pngBase64 = createTestPNG();

        await page.evaluate(async (fileData) => {
            // Convert base64 to Blob
            const byteCharacters = atob(fileData);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'image/png' });

            // Create a File object
            const file = new File([blob], 'paste.png', { type: 'image/png' });

            // Create clipboard data
            const clipboardData = new DataTransfer();
            clipboardData.items.add(file);

            // Create and dispatch paste event
            const pasteEvent = new ClipboardEvent('paste', {
                bubbles: true,
                cancelable: true,
                clipboardData: clipboardData
            });

            document.dispatchEvent(pasteEvent);
        }, pngBase64);

        // Wait for preview section to be visible
        await page.waitForSelector('#import-preview-section', { state: 'visible', timeout: 5000 });

        // Verify preview canvas is showing
        const previewCanvas = page.locator('#import-preview-canvas');
        await expect(previewCanvas).toBeVisible();
    });

    test('should handle paste with multiple clipboard items', async ({ page }) => {
        // Click import button
        await page.click('#btn-import');
        await page.waitForSelector('#import-dialog[open]', { timeout: 5000 });

        // Create paste event with text and image (should use image)
        const pngBase64 = createTestPNG();

        await page.evaluate(async (fileData) => {
            // Convert base64 to Blob
            const byteCharacters = atob(fileData);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'image/png' });
            const file = new File([blob], 'paste.png', { type: 'image/png' });

            // Create clipboard data with text and image
            const clipboardData = new DataTransfer();
            clipboardData.items.add('some text', 'text/plain');
            clipboardData.items.add(file);

            // Create and dispatch paste event
            const pasteEvent = new ClipboardEvent('paste', {
                bubbles: true,
                cancelable: true,
                clipboardData: clipboardData
            });

            document.dispatchEvent(pasteEvent);
        }, pngBase64);

        // Wait for preview section to be visible
        await page.waitForSelector('#import-preview-section', { state: 'visible', timeout: 5000 });

        // Verify preview loaded
        const previewCanvas = page.locator('#import-preview-canvas');
        await expect(previewCanvas).toBeVisible();
    });

    test('should not handle paste when dialog is closed', async ({ page }) => {
        // Don't open the dialog

        // Try to paste an image
        const pngBase64 = createTestPNG();

        await page.evaluate(async (fileData) => {
            const byteCharacters = atob(fileData);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'image/png' });
            const file = new File([blob], 'paste.png', { type: 'image/png' });

            const clipboardData = new DataTransfer();
            clipboardData.items.add(file);

            const pasteEvent = new ClipboardEvent('paste', {
                bubbles: true,
                cancelable: true,
                clipboardData: clipboardData
            });

            document.dispatchEvent(pasteEvent);
        }, pngBase64);

        // Wait a bit
        await page.waitForTimeout(500);

        // Dialog should not have opened
        const importDialog = page.locator('#import-dialog[open]');
        await expect(importDialog).not.toBeVisible();
    });

    test('should remove paste listener when dialog closes', async ({ page }) => {
        // Open dialog
        await page.click('#btn-import');
        await page.waitForSelector('#import-dialog[open]', { timeout: 5000 });

        // Close dialog
        await page.click('#import-cancel-no-file');
        await page.waitForSelector('#import-dialog[open]', { state: 'detached', timeout: 5000 });

        // Try to paste an image
        const pngBase64 = createTestPNG();

        await page.evaluate(async (fileData) => {
            const byteCharacters = atob(fileData);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'image/png' });
            const file = new File([blob], 'paste.png', { type: 'image/png' });

            const clipboardData = new DataTransfer();
            clipboardData.items.add(file);

            const pasteEvent = new ClipboardEvent('paste', {
                bubbles: true,
                cancelable: true,
                clipboardData: clipboardData
            });

            document.dispatchEvent(pasteEvent);
        }, pngBase64);

        // Wait a bit
        await page.waitForTimeout(500);

        // Dialog should not have opened again
        const importDialog = page.locator('#import-dialog[open]');
        await expect(importDialog).not.toBeVisible();
    });

    test('should ignore paste without image data', async ({ page }) => {
        // Click import button
        await page.click('#btn-import');
        await page.waitForSelector('#import-dialog[open]', { timeout: 5000 });

        // Paste text only
        await page.evaluate(() => {
            const clipboardData = new DataTransfer();
            clipboardData.items.add('some text', 'text/plain');

            const pasteEvent = new ClipboardEvent('paste', {
                bubbles: true,
                cancelable: true,
                clipboardData: clipboardData
            });

            document.dispatchEvent(pasteEvent);
        });

        // Wait a bit
        await page.waitForTimeout(500);

        // Preview should not be visible (stay in file selection mode)
        const previewSection = page.locator('#import-preview-section');
        await expect(previewSection).not.toBeVisible();

        // File selection should still be visible
        const fileSelection = page.locator('#import-file-selection');
        await expect(fileSelection).toBeVisible();
    });
});
