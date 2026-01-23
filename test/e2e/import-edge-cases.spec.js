import { test, expect } from '@playwright/test';

// Helper function to create a test PNG file as base64
function createTestPNG() {
    // 1x1 red PNG
    return 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
}

test.describe('Import Dialog Edge Cases', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:8080/imgedit.html');
        await page.waitForLoadState('networkidle');
    });

    test('should handle drop of unsupported image format (BMP)', async ({ page }) => {
        // Click import button
        await page.click('#btn-import');
        await page.waitForSelector('#import-dialog[open]', { timeout: 5000 });

        // Drop a BMP file (unsupported)
        await page.evaluate(async () => {
            const dropZone = document.getElementById('import-drop-zone');

            // Create a BMP file (just fake data)
            const blob = new Blob(['BM fake bmp data'], { type: 'image/bmp' });
            const file = new File([blob], 'test.bmp', { type: 'image/bmp' });

            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);

            const dropEvent = new DragEvent('drop', {
                bubbles: true,
                cancelable: true,
                dataTransfer: dataTransfer
            });
            dropZone.dispatchEvent(dropEvent);
        });

        // Wait for error processing
        await page.waitForTimeout(500);

        // Snackbar should show error message
        const snackbar = page.locator('#snackbar');
        await expect(snackbar).toBeVisible();
        await expect(snackbar).toContainText('File format not supported');
    });

    test('should handle empty file list on drop', async ({ page }) => {
        // Click import button
        await page.click('#btn-import');
        await page.waitForSelector('#import-dialog[open]', { timeout: 5000 });

        // Drop with no files
        await page.evaluate(async () => {
            const dropZone = document.getElementById('import-drop-zone');
            const dataTransfer = new DataTransfer();

            const dropEvent = new DragEvent('drop', {
                bubbles: true,
                cancelable: true,
                dataTransfer: dataTransfer
            });
            dropZone.dispatchEvent(dropEvent);
        });

        // Wait a bit
        await page.waitForTimeout(500);

        // Should remain in file selection mode
        const fileSelection = page.locator('#import-file-selection');
        await expect(fileSelection).toBeVisible();
    });

    test('should clean up event listeners properly', async ({ page }) => {
        // Open and close dialog multiple times
        for (let i = 0; i < 3; i++) {
            // Open dialog
            await page.click('#btn-import');
            await page.waitForSelector('#import-dialog[open]', { timeout: 5000 });

            // Close dialog
            await page.click('#import-cancel-no-file');
            await page.waitForSelector('#import-dialog[open]', { state: 'detached', timeout: 5000 });
        }

        // Open one more time and verify paste works
        await page.click('#btn-import');
        await page.waitForSelector('#import-dialog[open]', { timeout: 5000 });

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

        // Verify preview shows
        await page.waitForSelector('#import-preview-section', { state: 'visible', timeout: 5000 });
    });

    test('should handle very long filename', async ({ page }) => {
        // Click import button
        await page.click('#btn-import');
        await page.waitForSelector('#import-dialog[open]', { timeout: 5000 });

        const pngBase64 = createTestPNG();
        const longFilename = 'a'.repeat(200) + '.png';

        await page.evaluate(async ({ fileData, filename }) => {
            const dropZone = document.getElementById('import-drop-zone');

            const byteCharacters = atob(fileData);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'image/png' });
            const file = new File([blob], filename, { type: 'image/png' });

            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);

            const dropEvent = new DragEvent('drop', {
                bubbles: true,
                cancelable: true,
                dataTransfer: dataTransfer
            });
            dropZone.dispatchEvent(dropEvent);
        }, { fileData: pngBase64, filename: longFilename });

        // Should still load successfully
        await page.waitForSelector('#import-preview-section', { state: 'visible', timeout: 5000 });
    });

    test('should handle file with no extension', async ({ page }) => {
        // Click import button
        await page.click('#btn-import');
        await page.waitForSelector('#import-dialog[open]', { timeout: 5000 });

        const pngBase64 = createTestPNG();

        await page.evaluate(async (fileData) => {
            const dropZone = document.getElementById('import-drop-zone');

            const byteCharacters = atob(fileData);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'image/png' });
            const file = new File([blob], 'test', { type: 'image/png' }); // No extension

            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);

            const dropEvent = new DragEvent('drop', {
                bubbles: true,
                cancelable: true,
                dataTransfer: dataTransfer
            });
            dropZone.dispatchEvent(dropEvent);
        }, pngBase64);

        // Should load successfully (MIME type is valid)
        await page.waitForSelector('#import-preview-section', { state: 'visible', timeout: 5000 });
    });

    test('should handle case-insensitive file extensions', async ({ page }) => {
        // Click import button
        await page.click('#btn-import');
        await page.waitForSelector('#import-dialog[open]', { timeout: 5000 });

        const pngBase64 = createTestPNG();

        await page.evaluate(async (fileData) => {
            const dropZone = document.getElementById('import-drop-zone');

            const byteCharacters = atob(fileData);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'image/png' });
            const file = new File([blob], 'test.PNG', { type: 'image/png' }); // Uppercase extension

            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);

            const dropEvent = new DragEvent('drop', {
                bubbles: true,
                cancelable: true,
                dataTransfer: dataTransfer
            });
            dropZone.dispatchEvent(dropEvent);
        }, pngBase64);

        // Should load successfully
        await page.waitForSelector('#import-preview-section', { state: 'visible', timeout: 5000 });
    });

    test('drag-over class should handle rapid enter/leave', async ({ page }) => {
        // Click import button
        await page.click('#btn-import');
        await page.waitForSelector('#import-dialog[open]', { timeout: 5000 });

        // Rapid drag enter/leave cycles
        for (let i = 0; i < 5; i++) {
            await page.evaluate(() => {
                const dropZone = document.getElementById('import-drop-zone');
                dropZone.dispatchEvent(new DragEvent('dragenter', { bubbles: true }));
                dropZone.dispatchEvent(new DragEvent('dragleave', { bubbles: true }));
            });
        }

        // Final dragenter
        await page.evaluate(() => {
            const dropZone = document.getElementById('import-drop-zone');
            dropZone.dispatchEvent(new DragEvent('dragenter', { bubbles: true }));
        });

        // Should have drag-over class
        const dropZone = page.locator('#import-drop-zone');
        await expect(dropZone).toHaveClass(/drag-over/);
    });
});
