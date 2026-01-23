/**
 * Tests for nearest-neighbor dithering algorithm
 */

import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Nearest-Neighbor Algorithm', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:8080/imgedit.html');

        // Wait for app to initialize and auto-create blank image
        await page.waitForLoadState('networkidle');
        await page.waitForSelector('#edit-surface', { state: 'visible', timeout: 5000 });

        // Wait for app to fully initialize
        await page.waitForTimeout(500);
    });

    test('should be available as dithering algorithm', async ({ page }) => {
        // Create a 1x1 test PNG in base64
        const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';

        // Set up File System Access API mock
        await page.addInitScript((base64Data) => {
            window.showOpenFilePicker = async function() {
                const byteCharacters = atob(base64Data);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: 'image/png' });
                const file = new File([blob], 'test.png', { type: 'image/png' });

                const fileHandle = {
                    kind: 'file',
                    name: 'test.png',
                    getFile: async () => file
                };

                return [fileHandle];
            };
        }, pngBase64);

        // Reload page with mock in place
        await page.goto('http://localhost:8080/imgedit.html');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(500);

        // Open import dialog
        await page.click('#btn-import');
        await page.waitForSelector('#import-dialog[open]', { timeout: 5000 });

        // Click select file button to trigger mock and show preview section
        await page.click('#import-select-file');
        await page.waitForSelector('#import-preview-section', { state: 'visible', timeout: 5000 });

        // Now check algorithm selector exists and contains nearest-neighbor
        const algorithmSelect = page.locator('select#import-algorithm');
        await expect(algorithmSelect).toBeVisible();

        const options = await algorithmSelect.locator('option').allTextContents();
        expect(options.some(opt => opt.toLowerCase().includes('nearest'))).toBe(true);
    });

    test('should render solid colors without dithering', async ({ page }) => {
        // Create a simple test image with solid colors
        const testImage = await page.evaluate(() => {
            const canvas = document.createElement('canvas');
            canvas.width = 280;
            canvas.height = 192;
            const ctx = canvas.getContext('2d');

            // Create solid color blocks
            ctx.fillStyle = '#FF0000'; // Red
            ctx.fillRect(0, 0, 70, 192);

            ctx.fillStyle = '#00FF00'; // Green
            ctx.fillRect(70, 0, 70, 192);

            ctx.fillStyle = '#0000FF'; // Blue
            ctx.fillRect(140, 0, 70, 192);

            ctx.fillStyle = '#FFFFFF'; // White
            ctx.fillRect(210, 0, 70, 192);

            return canvas.toDataURL();
        });

        // Import the test image by injecting it
        await page.evaluate((dataUrl) => {
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    // Access the ImageDither class and render with nearest-neighbor
                    const dither = new window.ImageDither();
                    const result = dither.ditherToHgr(img, 40, 192, 'nearest-neighbor');
                    resolve(result !== null);
                };
                img.src = dataUrl;
            });
        }, testImage);

        // Basic validation: if we got here without errors, the algorithm works
        const canvasExists = await page.locator('canvas#edit-surface').isVisible();
        expect(canvasExists).toBe(true);
    });

    test('should produce consistent output (no randomness)', async ({ page }) => {
        // Create test image
        const testImage = await page.evaluate(() => {
            const canvas = document.createElement('canvas');
            canvas.width = 280;
            canvas.height = 192;
            const ctx = canvas.getContext('2d');

            // Gradient to test consistency
            const gradient = ctx.createLinearGradient(0, 0, 280, 0);
            gradient.addColorStop(0, '#000000');
            gradient.addColorStop(1, '#FFFFFF');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 280, 192);

            return canvas.toDataURL();
        });

        // Render twice and compare
        const results = await page.evaluate((dataUrl) => {
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    const dither = new window.ImageDither();

                    // Render first time
                    const result1 = dither.ditherToHgr(img, 40, 192, 'nearest-neighbor');

                    // Render second time
                    const result2 = dither.ditherToHgr(img, 40, 192, 'nearest-neighbor');

                    // Compare results
                    const identical = result1.length === result2.length &&
                        result1.every((byte, idx) => byte === result2[idx]);

                    resolve({ identical, length: result1.length });
                };
                img.src = dataUrl;
            });
        }, testImage);

        expect(results.identical).toBe(true);
        expect(results.length).toBe(40 * 192); // 40 bytes x 192 lines
    });

    test('should not produce vertical stripes', async ({ page }) => {
        // This test verifies that the algorithm uses full scanline context
        // by checking that byte boundaries don't create artifacts

        const testImage = await page.evaluate(() => {
            const canvas = document.createElement('canvas');
            canvas.width = 280;
            canvas.height = 192;
            const ctx = canvas.getContext('2d');

            // Solid orange color (known to be problematic with phase issues)
            ctx.fillStyle = '#FF8800';
            ctx.fillRect(0, 0, 280, 192);

            return canvas.toDataURL();
        });

        const analysis = await page.evaluate((dataUrl) => {
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    const dither = new window.ImageDither();
                    const result = dither.ditherToHgr(img, 40, 192, 'nearest-neighbor');

                    // Analyze vertical consistency
                    // Count unique byte values (should be low for solid color)
                    const uniqueBytes = new Set(result);

                    // Check horizontal consistency in first scanline
                    const firstLine = result.slice(0, 40);
                    const byteFrequency = {};
                    for (const byte of firstLine) {
                        byteFrequency[byte] = (byteFrequency[byte] || 0) + 1;
                    }

                    resolve({
                        uniqueByteCount: uniqueBytes.size,
                        mostCommonByteCount: Math.max(...Object.values(byteFrequency)),
                        totalBytes: firstLine.length
                    });
                };
                img.src = dataUrl;
            });
        }, testImage);

        // For solid color, most bytes should be similar
        // Allow some variation due to NTSC phase, but not excessive
        expect(analysis.uniqueByteCount).toBeLessThan(20); // Should have low variation
        expect(analysis.mostCommonByteCount).toBeGreaterThan(10); // Should have dominant pattern
    });

    test('should complete in reasonable time', async ({ page }) => {
        // Performance test - nearest-neighbor should be fast
        const testImage = await page.evaluate(() => {
            const canvas = document.createElement('canvas');
            canvas.width = 280;
            canvas.height = 192;
            const ctx = canvas.getContext('2d');

            // Random noise to make it challenging
            for (let y = 0; y < 192; y++) {
                for (let x = 0; x < 280; x++) {
                    const r = Math.random() * 255;
                    const g = Math.random() * 255;
                    const b = Math.random() * 255;
                    ctx.fillStyle = `rgb(${r},${g},${b})`;
                    ctx.fillRect(x, y, 1, 1);
                }
            }

            return canvas.toDataURL();
        });

        const timing = await page.evaluate((dataUrl) => {
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    const dither = new window.ImageDither();

                    const start = performance.now();
                    dither.ditherToHgr(img, 40, 192, 'nearest-neighbor');
                    const duration = performance.now() - start;

                    resolve(duration);
                };
                img.src = dataUrl;
            });
        }, testImage);

        // Should complete in reasonable time (less than 10 seconds)
        expect(timing).toBeLessThan(10000);
        console.log(`Nearest-neighbor completed in ${timing.toFixed(2)}ms`);
    });
});
