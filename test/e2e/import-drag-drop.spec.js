import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { join } from 'path';

// Helper function to create a test PNG file as base64
function createTestPNG() {
    // 1x1 red PNG
    return 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
}

test.describe('Import Dialog Drag and Drop', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:8080/imgedit.html');
        await page.waitForLoadState('networkidle');
    });

    test('should show drop zone when import dialog opens', async ({ page }) => {
        // Click import button
        await page.click('#btn-import');

        // Wait for import dialog to be visible
        await page.waitForSelector('#import-dialog[open]', { timeout: 5000 });

        // Check that drop zone is visible
        const dropZone = page.locator('#import-drop-zone');
        await expect(dropZone).toBeVisible();

        // Check drop zone content
        await expect(page.locator('.import-drop-instructions')).toBeVisible();
        await expect(page.locator('.import-drop-formats')).toBeVisible();
    });

    test('should add drag-over class when dragging over drop zone', async ({ page }) => {
        // Click import button
        await page.click('#btn-import');
        await page.waitForSelector('#import-dialog[open]', { timeout: 5000 });

        const dropZone = page.locator('#import-drop-zone');

        // Simulate dragenter event using page.evaluate
        await page.evaluate(() => {
            const dropZone = document.getElementById('import-drop-zone');
            const event = new DragEvent('dragenter', {
                bubbles: true,
                cancelable: true
            });
            dropZone.dispatchEvent(event);
        });

        // Check that drag-over class is added
        await expect(dropZone).toHaveClass(/drag-over/);
    });

    test('should remove drag-over class when drag leaves', async ({ page }) => {
        // Click import button
        await page.click('#btn-import');
        await page.waitForSelector('#import-dialog[open]', { timeout: 5000 });

        const dropZone = page.locator('#import-drop-zone');

        // Simulate dragenter
        await dropZone.dispatchEvent('dragenter');
        await expect(dropZone).toHaveClass(/drag-over/);

        // Simulate dragleave
        await dropZone.dispatchEvent('dragleave');

        // Check that drag-over class is removed
        await expect(dropZone).not.toHaveClass(/drag-over/);
    });

    test('should accept dropped image file', async ({ page }) => {
        // Click import button
        await page.click('#btn-import');
        await page.waitForSelector('#import-dialog[open]', { timeout: 5000 });

        // Create a file to drop
        const pngBase64 = createTestPNG();
        const buffer = Buffer.from(pngBase64, 'base64');

        // Use page.evaluate to create and drop a file
        await page.evaluate(async (fileData) => {
            const dropZone = document.getElementById('import-drop-zone');

            // Convert base64 to Blob
            const byteCharacters = atob(fileData);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'image/png' });

            // Create a File object
            const file = new File([blob], 'test.png', { type: 'image/png' });

            // Create DataTransfer object
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);

            // Dispatch drop event
            const dropEvent = new DragEvent('drop', {
                bubbles: true,
                cancelable: true,
                dataTransfer: dataTransfer
            });
            dropZone.dispatchEvent(dropEvent);
        }, pngBase64);

        // Wait for preview section to be visible
        await page.waitForSelector('#import-preview-section', { state: 'visible', timeout: 5000 });

        // Verify preview canvas is showing
        const previewCanvas = page.locator('#import-preview-canvas');
        await expect(previewCanvas).toBeVisible();
    });

    test('should handle multiple files by taking the first one', async ({ page }) => {
        // Click import button
        await page.click('#btn-import');
        await page.waitForSelector('#import-dialog[open]', { timeout: 5000 });

        // Create multiple files to drop
        const pngBase64 = createTestPNG();

        await page.evaluate(async (fileData) => {
            const dropZone = document.getElementById('import-drop-zone');

            // Convert base64 to Blob
            const byteCharacters = atob(fileData);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'image/png' });

            // Create multiple File objects
            const file1 = new File([blob], 'test1.png', { type: 'image/png' });
            const file2 = new File([blob], 'test2.png', { type: 'image/png' });

            // Create DataTransfer object with multiple files
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file1);
            dataTransfer.items.add(file2);

            // Dispatch drop event
            const dropEvent = new DragEvent('drop', {
                bubbles: true,
                cancelable: true,
                dataTransfer: dataTransfer
            });
            dropZone.dispatchEvent(dropEvent);
        }, pngBase64);

        // Wait for preview section to be visible (should use first file)
        await page.waitForSelector('#import-preview-section', { state: 'visible', timeout: 5000 });

        // Verify preview loaded
        const previewCanvas = page.locator('#import-preview-canvas');
        await expect(previewCanvas).toBeVisible();
    });

    test('should show error for invalid file type', async ({ page }) => {
        // Click import button
        await page.click('#btn-import');
        await page.waitForSelector('#import-dialog[open]', { timeout: 5000 });

        // Drop a text file instead of an image
        await page.evaluate(async () => {
            const dropZone = document.getElementById('import-drop-zone');

            // Create a text file
            const blob = new Blob(['test content'], { type: 'text/plain' });
            const file = new File([blob], 'test.txt', { type: 'text/plain' });

            // Create DataTransfer object
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);

            // Dispatch drop event
            const dropEvent = new DragEvent('drop', {
                bubbles: true,
                cancelable: true,
                dataTransfer: dataTransfer
            });
            dropZone.dispatchEvent(dropEvent);
        });

        // Wait a bit for error processing
        await page.waitForTimeout(500);

        // Snackbar should show error message
        const snackbar = page.locator('#snackbar');
        await expect(snackbar).toBeVisible();
        await expect(snackbar).toContainText('File format not supported');
    });

    test('clicking drop zone should open file picker', async ({ page }) => {
        // Mock showOpenFilePicker before loading the page
        await page.addInitScript(() => {
            window.showOpenFilePicker = async function() {
                window.pickerWasCalled = true;
                // User canceled
                throw new Error('User cancelled');
            };
        });

        // Reload page to apply init script
        await page.goto('http://localhost:8080/imgedit.html');
        await page.waitForLoadState('networkidle');

        // Click import button
        await page.click('#btn-import');
        await page.waitForSelector('#import-dialog[open]', { timeout: 5000 });

        // Click the drop zone
        await page.click('#import-drop-zone');

        // Wait a bit for the click to process
        await page.waitForTimeout(500);

        // Verify file picker was called
        const pickerCalled = await page.evaluate(() => window.pickerWasCalled);
        expect(pickerCalled).toBe(true);
    });
});
