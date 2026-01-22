/**
 * Test for byte boundary error diffusion bug.
 *
 * Bug Description:
 * When drawing gray #888 horizontal line with NTSC greedy dithering,
 * the pattern should alternate blue/orange consistently. However,
 * there was a bug where after 4 alternations (pixels 0-7), the pattern
 * would fail with blue/blue at pixels 8-9 instead of continuing the
 * alternation.
 *
 * Root Cause:
 * The sync version of greedyDitherScanline was not restoring the full
 * scanline context when rendering for error diffusion. It only restored
 * the current and previous byte, but NTSC rendering requires the full
 * left-hand context for accurate color calculation.
 *
 * Fix:
 * Changed the rendering loop to restore ALL bytes from 0 to byteX
 * before rendering for error diffusion, matching the async version.
 */

import { test, expect } from '@playwright/test';
import {
    waitForAppReady,
    selectTool,
    selectRenderMode,
    drawRectangle,
    getCanvasPixels,
    createNewImage
} from './helpers.js';

test.describe('Byte Boundary Error Diffusion', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/imgedit.html');
        await waitForAppReady(page);
        await createNewImage(page);
    });

    test('Gray #888 should alternate blue/orange across byte boundaries', async ({ page }) => {
        // Select NTSC mode and rectangle tool
        await selectRenderMode(page, 'ntsc');
        await selectTool(page, 'btn-fill-rect');

        // Set gray #888 color manually using color picker
        await page.evaluate(() => {
            const dialog = document.getElementById('color-picker-hgr');
            dialog.showModal();
        });
        await page.waitForTimeout(200);

        // Fill in RGB values
        await page.fill('#color-r', '136');
        await page.fill('#color-g', '136');
        await page.fill('#color-b', '136');
        await page.dispatchEvent('#color-r', 'input');
        await page.waitForTimeout(200);

        // Close dialog
        await page.evaluate(() => {
            document.getElementById('color-picker-hgr').close();
        });
        await page.waitForTimeout(200);

        // Draw rectangle covering at least 2 bytes (14 pixels)
        await drawRectangle(page, 0, 0, 20, 1);

        // Get pixel data for first 16 pixels
        const pixelData = await getCanvasPixels(page, 0, 0, 16, 1);
        const pixels = pixelData.data;

        // Helper to classify pixel color
        function classifyColor(r, g, b) {
            if (r < 100 && g > 100 && b > 128) return 'BLUE';
            if (r > 200 && g > 100 && b < 100) return 'ORANGE';
            if (r > 128 && g < 100 && b > 128) return 'PURPLE';
            return 'OTHER';
        }

        // Analyze pattern
        const pattern = [];
        for (let i = 0; i < 16; i++) {
            const r = pixels[i * 4];
            const g = pixels[i * 4 + 1];
            const b = pixels[i * 4 + 2];
            const color = classifyColor(r, g, b);
            pattern.push(color);
            console.log(`Pixel ${i.toString().padStart(2)}: rgb(${r}, ${g}, ${b}) -> ${color}`);
        }

        // Check for the specific bug: blue/blue at pixels 8-9
        test.info().annotations.push({
            type: 'bug-check',
            description: `Pattern at byte boundary (pixels 7-9): ${pattern[7]}, ${pattern[8]}, ${pattern[9]}`
        });

        // The bug manifests as two consecutive blue pixels at the byte boundary
        const hasBlueBlue = pattern[8] === 'BLUE' && pattern[9] === 'BLUE';

        if (hasBlueBlue) {
            console.error('BUG DETECTED: Found blue/blue at pixels 8-9');
            console.error('Full pattern:', pattern.join(', '));
        }

        // Verify no consecutive blue pixels
        for (let i = 0; i < pattern.length - 1; i++) {
            if (pattern[i] === 'BLUE' && pattern[i + 1] === 'BLUE') {
                throw new Error(`Found consecutive blue pixels at positions ${i}-${i + 1}`);
            }
        }

        // Verify alternating pattern (approximately)
        // Gray #888 should produce blue/orange checkerboard
        let blueCount = 0;
        let orangeCount = 0;
        for (const color of pattern) {
            if (color === 'BLUE') blueCount++;
            if (color === 'ORANGE') orangeCount++;
        }

        console.log(`Color distribution: ${blueCount} blue, ${orangeCount} orange`);

        // Should have roughly equal blue and orange
        expect(blueCount).toBeGreaterThan(0);
        expect(orangeCount).toBeGreaterThan(0);
        expect(Math.abs(blueCount - orangeCount)).toBeLessThan(4);
    });

    test('Verify byte 0 to byte 1 transition specifically', async ({ page }) => {
        await page.goto('http://localhost:8080');

        // Wait for canvas
        const canvas = page.locator('canvas#hgr-canvas');
        await expect(canvas).toBeVisible({ timeout: 10000 });

        // Setup: Rectangle, NTSC, gray #888
        await page.click('button#tool-rect');
        await page.click('input[name="render-mode"][value="ntsc"]');
        await page.click('button#color-0');
        await page.fill('input#color-r', '136');
        await page.fill('input#color-g', '136');
        await page.fill('input#color-b', '136');
        await page.dispatchEvent('input#color-r', 'input');
        await page.click('button[data-action="close"]');
        await page.waitForTimeout(100);

        // Draw horizontal line
        await page.mouse.move(50, 50);
        await page.mouse.down();
        await page.mouse.move(150, 50);
        await page.mouse.up();
        await page.waitForTimeout(200);

        // Get pixels at byte boundary
        // Byte 0: pixels 0-6 (7 pixels)
        // Byte 1: pixels 7-13 (7 pixels)
        const pixel6 = await getCanvasPixels(page, 6, 0, 1, 1);
        const pixel7 = await getCanvasPixels(page, 7, 0, 1, 1);
        const pixel8 = await getCanvasPixels(page, 8, 0, 1, 1);

        function classifyColor(r, g, b) {
            if (r < 100 && g > 100 && b > 128) return 'BLUE';
            if (r > 200 && g > 100 && b < 100) return 'ORANGE';
            return 'OTHER';
        }

        const color6 = classifyColor(pixel6[0], pixel6[1], pixel6[2]);
        const color7 = classifyColor(pixel7[0], pixel7[1], pixel7[2]);
        const color8 = classifyColor(pixel8[0], pixel8[1], pixel8[2]);

        console.log(`Pixel 6 (byte 0, last): ${color6}`);
        console.log(`Pixel 7 (byte 1, first): ${color7}`);
        console.log(`Pixel 8 (byte 1, second): ${color8}`);

        // Pixels 6 and 7 should be different colors
        expect(color6).not.toBe(color7);

        // Pixels 7 and 8 should be different colors
        expect(color7).not.toBe(color8);

        // Specifically check the reported bug pattern
        if (color7 === 'BLUE' && color8 === 'BLUE') {
            throw new Error('BUG: Found blue/blue at pixels 7-8 (byte boundary)');
        }
    });
});
