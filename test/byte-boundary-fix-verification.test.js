/**
 * Verification test for byte boundary error diffusion fix.
 *
 * Problem: Error was being diffused rightward across byte boundaries,
 * causing double-counting because NTSC renderer already handles color
 * bleed between bytes.
 *
 * Fix: Block rightward error diffusion at byte boundaries (pixel % 7 === 6).
 * Still allow downward diffusion because vertical scanlines are independent.
 */

import { describe, it, expect } from 'vitest';
import { greedyDitherScanline } from '../docs/lib/greedy-dither.js';
import NTSCRenderer from '../docs/lib/ntsc-renderer.js';
import fs from 'fs';
import { PNG } from 'pngjs';

describe('Byte Boundary Error Diffusion Fix', () => {
    it('should produce clean solid white with no byte boundary artifacts', () => {
        // Create solid white 280x192 image
        const width = 280;
        const height = 192;
        const pixels = new Uint8ClampedArray(width * height * 4);

        // Fill with white
        for (let i = 0; i < pixels.length; i += 4) {
            pixels[i] = 255;     // R
            pixels[i + 1] = 255; // G
            pixels[i + 2] = 255; // B
            pixels[i + 3] = 255; // A
        }

        // Initialize renderer and buffers
        const renderer = new NTSCRenderer();
        const errorBuffer = new Array(width * height);
        const imageData = new ImageData(560, 1);
        const hgrBytes = new Uint8Array(40);
        const targetWidth = 40;

        // Dither first scanline
        const scanline = greedyDitherScanline(
            pixels,
            errorBuffer,
            0,
            targetWidth,
            width,
            height,
            renderer,
            imageData,
            hgrBytes
        );

        // Render the result
        const outputImageData = new ImageData(560, 1);
        renderer.renderHgrScanline(outputImageData, scanline, 0, 0);

        // Analyze for byte boundary artifacts
        // Check pixels at byte boundaries (7, 14, 21, 28...)
        const byteBoundaryIssues = [];
        for (let byteIdx = 1; byteIdx < targetWidth; byteIdx++) {
            const pixelIdx = byteIdx * 7; // First pixel of each byte
            const ntscIdx = pixelIdx * 2 * 4; // Convert to NTSC pixel index

            const r = outputImageData.data[ntscIdx];
            const g = outputImageData.data[ntscIdx + 1];
            const b = outputImageData.data[ntscIdx + 2];

            // Check if color is NOT white (allowing some tolerance)
            if (r < 200 || g < 200 || b < 200) {
                byteBoundaryIssues.push({
                    byte: byteIdx,
                    pixel: pixelIdx,
                    color: { r, g, b }
                });
            }
        }

        if (byteBoundaryIssues.length > 0) {
            console.error('Byte boundary artifacts detected:');
            byteBoundaryIssues.forEach(issue => {
                console.error(`  Byte ${issue.byte} (pixel ${issue.pixel}): RGB(${issue.color.r}, ${issue.color.g}, ${issue.color.b})`);
            });
        }

        // Should have no byte boundary artifacts
        expect(byteBoundaryIssues.length).toBe(0);

        // Overall white pixel percentage should be high
        let whitePixels = 0;
        for (let i = 0; i < outputImageData.data.length; i += 4) {
            const r = outputImageData.data[i];
            const g = outputImageData.data[i + 1];
            const b = outputImageData.data[i + 2];
            if (r > 200 && g > 200 && b > 200) {
                whitePixels++;
            }
        }

        const totalPixels = outputImageData.data.length / 4;
        const whitePercentage = (whitePixels / totalPixels) * 100;

        console.log(`White pixels: ${whitePixels} / ${totalPixels} (${whitePercentage.toFixed(2)}%)`);
        expect(whitePercentage).toBeGreaterThan(95);
    });

    it('should not accumulate unbounded error in buffer', () => {
        // Create gradient image to generate consistent error
        const width = 280;
        const height = 10;
        const pixels = new Uint8ClampedArray(width * height * 4);

        // Fill with gray gradient
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                const gray = 128 + (x / width) * 100; // Gradient from 128 to 228
                pixels[idx] = gray;
                pixels[idx + 1] = gray;
                pixels[idx + 2] = gray;
                pixels[idx + 3] = 255;
            }
        }

        // Initialize renderer and buffers
        const renderer = new NTSCRenderer();
        const errorBuffer = new Array(width * height);
        const targetWidth = 40;

        // Dither multiple scanlines
        for (let y = 0; y < height; y++) {
            const imageData = new ImageData(560, 1);
            const hgrBytes = new Uint8Array(40);
            greedyDitherScanline(
                pixels,
                errorBuffer,
                y,
                targetWidth,
                width,
                height,
                renderer,
                imageData,
                hgrBytes
            );
        }

        // Check that error buffer values are clamped
        let maxError = 0;
        let unboundedErrors = 0;

        for (let i = 0; i < errorBuffer.length; i++) {
            if (errorBuffer[i]) {
                const errR = Math.abs(errorBuffer[i].r);
                const errG = Math.abs(errorBuffer[i].g);
                const errB = Math.abs(errorBuffer[i].b);

                maxError = Math.max(maxError, errR, errG, errB);

                // Check if any component exceeds the clamp limit
                if (errR > 255 || errG > 255 || errB > 255) {
                    unboundedErrors++;
                }
            }
        }

        console.log(`Max error in buffer: ${maxError.toFixed(2)}`);
        console.log(`Unbounded errors: ${unboundedErrors}`);

        // All errors should be clamped to [-255, 255]
        expect(maxError).toBeLessThanOrEqual(255);
        expect(unboundedErrors).toBe(0);
    });

    it('should produce visually smooth cat image without byte stripes', async () => {
        // Load cat test image
        const catPath = '/Users/brobert/Documents/code/hgrtool/test/fixtures/cat-bill-128x128.png';

        if (!fs.existsSync(catPath)) {
            console.log('Cat test image not found, skipping visual test');
            return;
        }

        const png = PNG.sync.read(fs.readFileSync(catPath));

        // Resize/crop to 280x192 for HGR
        const targetWidth = 280;
        const targetHeight = 192;
        const pixels = new Uint8ClampedArray(targetWidth * targetHeight * 4);

        // Simple center crop and scale
        const scaleX = png.width / targetWidth;
        const scaleY = png.height / targetHeight;

        for (let y = 0; y < targetHeight; y++) {
            for (let x = 0; x < targetWidth; x++) {
                const srcX = Math.floor(x * scaleX);
                const srcY = Math.floor(y * scaleY);
                const srcIdx = (srcY * png.width + srcX) * 4;
                const dstIdx = (y * targetWidth + x) * 4;

                pixels[dstIdx] = png.data[srcIdx];
                pixels[dstIdx + 1] = png.data[srcIdx + 1];
                pixels[dstIdx + 2] = png.data[srcIdx + 2];
                pixels[dstIdx + 3] = 255;
            }
        }

        // Dither the image
        const renderer = new NTSCRenderer();
        const errorBuffer = new Array(targetWidth * targetHeight);
        const hgrData = new Uint8Array(40 * targetHeight);

        for (let y = 0; y < targetHeight; y++) {
            const imageData = new ImageData(560, 1);
            const hgrBytes = new Uint8Array(40);
            const scanline = greedyDitherScanline(
                pixels,
                errorBuffer,
                y,
                40,
                targetWidth,
                targetHeight,
                renderer,
                imageData,
                hgrBytes
            );
            hgrData.set(scanline, y * 40);
        }

        // Render full image
        const outputImage = new ImageData(560, targetHeight);
        for (let y = 0; y < targetHeight; y++) {
            const scanline = new Uint8Array(40);
            for (let x = 0; x < 40; x++) {
                scanline[x] = hgrData[y * 40 + x];
            }
            renderer.renderHgrScanline(outputImage, scanline, 0, y);
        }

        // Save output for visual inspection
        const outputPng = new PNG({ width: 560, height: targetHeight });
        outputPng.data = Buffer.from(outputImage.data);
        fs.writeFileSync('/Users/brobert/Documents/code/hgrtool/test-output/cat-greedy-byte-boundary-fix.png', PNG.sync.write(outputPng));

        console.log('Saved output to test-output/cat-greedy-byte-boundary-fix.png');

        // Quantitative check: Look for vertical stripes at byte boundaries
        // by checking variance in columns at byte boundaries vs middle of bytes
        const byteBoundaryColumns = [7, 14, 21, 28, 35]; // First pixel of bytes 1-5
        const midByteColumns = [3, 10, 17, 24, 31]; // Middle of bytes 0-4

        function columnVariance(ntscX) {
            const values = [];
            for (let y = 0; y < targetHeight; y++) {
                const idx = (y * 560 + ntscX) * 4;
                const brightness = (outputImage.data[idx] + outputImage.data[idx + 1] + outputImage.data[idx + 2]) / 3;
                values.push(brightness);
            }

            const mean = values.reduce((a, b) => a + b, 0) / values.length;
            const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
            return variance;
        }

        const boundaryVariances = byteBoundaryColumns.map(x => columnVariance(x * 2));
        const midByteVariances = midByteColumns.map(x => columnVariance(x * 2));

        const avgBoundaryVariance = boundaryVariances.reduce((a, b) => a + b, 0) / boundaryVariances.length;
        const avgMidByteVariance = midByteVariances.reduce((a, b) => a + b, 0) / midByteVariances.length;

        console.log(`Average variance at byte boundaries: ${avgBoundaryVariance.toFixed(2)}`);
        console.log(`Average variance at mid-byte: ${avgMidByteVariance.toFixed(2)}`);

        // Byte boundary variance should not be significantly higher than mid-byte
        // (indicating no strong vertical stripes)
        const varianceRatio = avgBoundaryVariance / avgMidByteVariance;
        console.log(`Variance ratio (boundary/mid): ${varianceRatio.toFixed(2)}`);

        // Ratio should be close to 1.0 (no systematic difference)
        expect(varianceRatio).toBeLessThan(1.5);
        expect(varianceRatio).toBeGreaterThan(0.67); // 1/1.5
    });
});
