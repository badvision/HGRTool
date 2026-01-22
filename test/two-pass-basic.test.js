/**
 * Basic test to verify two-pass dithering works correctly.
 */

import { describe, it, expect } from 'vitest';
import ImageDither from '../docs/src/lib/image-dither.js';

describe('Two-Pass Dithering', () => {
    it('should dither a simple solid white image', { timeout: 60000 }, () => {
        // Create a simple 280x10 solid white image (smaller for faster test)
        const width = 280;
        const height = 10;
        const imageData = new ImageData(width, height);

        // Fill with white (255, 255, 255)
        for (let i = 0; i < width * height; i++) {
            const offset = i * 4;
            imageData.data[offset] = 255;     // R
            imageData.data[offset + 1] = 255; // G
            imageData.data[offset + 2] = 255; // B
            imageData.data[offset + 3] = 255; // A
        }

        // Create ditherer and convert
        const ditherer = new ImageDither();
        const hgrData = ditherer.ditherToHgr(imageData, 40, 10, "two-pass");

        // Verify we got output
        expect(hgrData).toBeDefined();
        expect(hgrData.length).toBe(40 * 10);

        // Verify not all bytes are zero (would indicate algorithm didn't run)
        let nonZeroCount = 0;
        for (let i = 0; i < hgrData.length; i++) {
            if (hgrData[i] !== 0) {
                nonZeroCount++;
            }
        }
        expect(nonZeroCount).toBeGreaterThan(0);

        console.log(`Two-pass dithering produced ${nonZeroCount} non-zero bytes out of ${hgrData.length}`);
    });

    it('should produce different results than nearest-neighbor alone', { timeout: 60000 }, () => {
        // Create a gradient image that should show error diffusion effects
        const width = 280;
        const height = 10; // Smaller for faster test
        const imageData = new ImageData(width, height);

        // Create horizontal gradient
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const gray = Math.floor((x / width) * 255);
                const idx = (y * width + x) * 4;
                imageData.data[idx] = gray;     // R
                imageData.data[idx + 1] = gray; // G
                imageData.data[idx + 2] = gray; // B
                imageData.data[idx + 3] = 255;  // A
            }
        }

        const ditherer = new ImageDither();

        // Get results from both algorithms
        const nearestNeighborData = ditherer.ditherToHgr(imageData, 40, 10, "nearest-neighbor");
        const twoPassData = ditherer.ditherToHgr(imageData, 40, 10, "two-pass");

        // They should be different due to error diffusion in second pass
        let differentBytes = 0;
        for (let i = 0; i < nearestNeighborData.length; i++) {
            if (nearestNeighborData[i] !== twoPassData[i]) {
                differentBytes++;
            }
        }

        console.log(`Two-pass differs from nearest-neighbor in ${differentBytes} out of ${nearestNeighborData.length} bytes`);

        // Expect at least some differences due to error diffusion
        expect(differentBytes).toBeGreaterThan(0);
    });
});
