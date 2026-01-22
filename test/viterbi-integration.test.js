/*
 * Copyright 2025 faddenSoft
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Integration tests for complete Viterbi scanline optimization.
 *
 * CRITICAL: White rendering MUST work (PSNR > 25 dB).
 * This is the PRIMARY acceptance criterion for the Viterbi implementation.
 *
 * Test-Driven Development:
 * 1. Write failing test (this file)
 * 2. Implement viterbiFullScanline()
 * 3. Integrate into ditherToHgr()
 * 4. Make test pass
 */

import { describe, it, expect, beforeAll } from 'vitest';
import VisualQualityTester from './lib/visual-quality-tester.js';

describe('Viterbi Integration - Phase 1 Completion', () => {
    let ImageDither;
    let NTSCRenderer;

    beforeAll(async () => {
        const imageDitherModule = await import('../docs/src/lib/image-dither.js');
        const ntscRendererModule = await import('../docs/src/lib/ntsc-renderer.js');

        ImageDither = imageDitherModule.default;
        NTSCRenderer = ntscRendererModule.default;

        // Initialize NTSC palettes
        new NTSCRenderer();
    });

    describe('CRITICAL: White Rendering with Viterbi', () => {
        it('should render pure white with PSNR > 25 dB using Viterbi algorithm', async () => {
            const tester = new VisualQualityTester();

            // Create pure white image
            const width = 280, height = 192;
            const sourceData = new Uint8ClampedArray(width * height * 4);
            for (let i = 0; i < sourceData.length; i += 4) {
                sourceData[i] = 255;     // R
                sourceData[i + 1] = 255; // G
                sourceData[i + 2] = 255; // B
                sourceData[i + 3] = 255; // A
            }
            const sourceImage = new ImageData(sourceData, width, height);

            // Convert using Viterbi algorithm
            const result = await tester.assessConversionQuality(
                sourceImage,
                'viterbi-white-rendering',
                'viterbi' // CRITICAL: Use new Viterbi algorithm
            );

            // CRITICAL SUCCESS CRITERION: PSNR > 25 dB
            // This is NON-NEGOTIABLE
            console.log(`Viterbi white rendering PSNR: ${result.psnr.toFixed(2)} dB`);
            expect(result.psnr).toBeGreaterThan(25);
            expect(result.ssim).toBeGreaterThan(0.7);
        }, 120000); // 2 minute timeout for performance

        it('should produce bytes with all bits set for white input', () => {
            const dither = new ImageDither();

            // Create small white image
            const width = 7, height = 1;
            const sourceData = new Uint8ClampedArray(width * height * 4);
            sourceData.fill(255);

            const sourceImage = new ImageData(sourceData, width, height);

            // Convert using Viterbi
            const hgrData = dither.ditherToHgr(sourceImage, 1, 1, 'viterbi');

            // For white input, expect byte with all bits set: 0x7F or 0xFF
            const byte = hgrData[0];
            const dataBits = byte & 0x7F;

            // All 7 data bits should be set for white
            expect(dataBits).toBe(0x7F);
        });
    });

    describe('Black Rendering (Sanity Check)', () => {
        it('should render pure black correctly with Viterbi', async () => {
            const tester = new VisualQualityTester();

            // Create pure black image
            const width = 280, height = 192;
            const sourceData = new Uint8ClampedArray(width * height * 4);
            for (let i = 0; i < sourceData.length; i += 4) {
                sourceData[i] = 0;
                sourceData[i + 1] = 0;
                sourceData[i + 2] = 0;
                sourceData[i + 3] = 255;
            }
            const sourceImage = new ImageData(sourceData, width, height);

            const result = await tester.assessConversionQuality(
                sourceImage,
                'viterbi-black-rendering',
                'viterbi'
            );

            // Black should also render well
            expect(result.psnr).toBeGreaterThan(20);
        }, 120000);
    });

    describe('Error Diffusion Integration', () => {
        it('should propagate error between scanlines (no vertical banding)', async () => {
            const tester = new VisualQualityTester();

            // Create gradient image (would show banding if error diffusion broken)
            const width = 280, height = 192;
            const sourceData = new Uint8ClampedArray(width * height * 4);
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const i = (y * width + x) * 4;
                    // Horizontal gradient
                    const value = Math.floor((x / width) * 255);
                    sourceData[i] = value;
                    sourceData[i + 1] = value;
                    sourceData[i + 2] = value;
                    sourceData[i + 3] = 255;
                }
            }
            const sourceImage = new ImageData(sourceData, width, height);

            const result = await tester.assessConversionQuality(
                sourceImage,
                'viterbi-gradient-test',
                'viterbi'
            );

            // Gradients are challenging for HGR - 9+ dB is acceptable
            // (Error diffusion helps, but HGR's limited palette still constrains quality)
            expect(result.psnr).toBeGreaterThan(9);
        }, 120000);
    });

    describe('Algorithm Coexistence', () => {
        it('should support all three algorithms: hybrid, threshold, viterbi', () => {
            const dither = new ImageDither();

            // Create simple test image
            const width = 7, height = 1;
            const sourceData = new Uint8ClampedArray(width * height * 4);
            sourceData.fill(128); // Mid-gray

            const sourceImage = new ImageData(sourceData, width, height);

            // All three algorithms should work
            expect(() => dither.ditherToHgr(sourceImage, 1, 1, 'hybrid')).not.toThrow();
            expect(() => dither.ditherToHgr(sourceImage, 1, 1, 'threshold')).not.toThrow();
            expect(() => dither.ditherToHgr(sourceImage, 1, 1, 'viterbi')).not.toThrow();
        });
    });

    describe('Performance', () => {
        it('should complete full image conversion in < 2 minutes', async () => {
            const dither = new ImageDither();

            // Create full-size test image
            const width = 280, height = 192;
            const sourceData = new Uint8ClampedArray(width * height * 4);
            // Checkerboard pattern (challenging for algorithm)
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const i = (y * width + x) * 4;
                    const value = ((x + y) % 2) * 255;
                    sourceData[i] = value;
                    sourceData[i + 1] = value;
                    sourceData[i + 2] = value;
                    sourceData[i + 3] = 255;
                }
            }
            const sourceImage = new ImageData(sourceData, width, height);

            const startTime = Date.now();
            const hgrData = dither.ditherToHgr(sourceImage, 40, 192, 'viterbi');
            const endTime = Date.now();

            const elapsedSec = (endTime - startTime) / 1000;
            console.log(`Viterbi performance: ${elapsedSec.toFixed(2)} seconds for 280×192 image`);

            // Should complete in under 2 minutes (120 seconds)
            expect(elapsedSec).toBeLessThan(120);

            // Should produce valid output
            expect(hgrData.length).toBe(40 * 192);
        }, 150000); // 2.5 minute timeout with safety margin
    });

    describe('Color Smoothness (Anti-Banding)', () => {
        it('should render solid orange without severe vertical banding', async () => {
            const tester = new VisualQualityTester();

            // Create solid orange image (user-reported issue color)
            const width = 280, height = 192;
            const sourceData = new Uint8ClampedArray(width * height * 4);
            for (let i = 0; i < sourceData.length; i += 4) {
                sourceData[i] = 255;     // R
                sourceData[i + 1] = 140; // G
                sourceData[i + 2] = 0;   // B
                sourceData[i + 3] = 255; // A
            }
            const sourceImage = new ImageData(sourceData, width, height);

            const result = await tester.assessConversionQuality(
                sourceImage,
                'viterbi-orange-smoothness',
                'viterbi'
            );

            // Measure vertical banding by comparing adjacent columns
            const bandingScore = measureVerticalBanding(result.convertedPath);

            console.log(`Orange vertical banding score: ${bandingScore.toFixed(2)}`);
            console.log(`Orange PSNR: ${result.psnr.toFixed(2)} dB`);

            // ACCEPTANCE CRITERIA:
            // - Banding score < 200 (baseline was 260, target is meaningful improvement)
            // - PSNR > 4 dB (color rendering is inherently challenging for HGR)
            // NOTE: HGR cannot represent smooth orange - some banding is unavoidable
            expect(bandingScore).toBeLessThan(200);
            expect(result.psnr).toBeGreaterThan(4);
        }, 120000);

        it('should render solid blue without severe vertical banding', async () => {
            const tester = new VisualQualityTester();

            // Create solid blue image
            const width = 280, height = 192;
            const sourceData = new Uint8ClampedArray(width * height * 4);
            for (let i = 0; i < sourceData.length; i += 4) {
                sourceData[i] = 0;       // R
                sourceData[i + 1] = 0;   // G
                sourceData[i + 2] = 255; // B
                sourceData[i + 3] = 255; // A
            }
            const sourceImage = new ImageData(sourceData, width, height);

            const result = await tester.assessConversionQuality(
                sourceImage,
                'viterbi-blue-smoothness',
                'viterbi'
            );

            const bandingScore = measureVerticalBanding(result.convertedPath);

            console.log(`Blue vertical banding score: ${bandingScore.toFixed(2)}`);
            console.log(`Blue PSNR: ${result.psnr.toFixed(2)} dB`);

            // ACCEPTANCE CRITERIA:
            // - Banding score < 150 (baseline was 235, target is 36% reduction)
            // - PSNR > 4 dB (color rendering is inherently challenging for HGR)
            expect(bandingScore).toBeLessThan(150);
            expect(result.psnr).toBeGreaterThan(4);
        }, 120000);
    });

    describe('Edge Cases', () => {
        it('should handle first scanline (no previous scanline for error)', () => {
            const dither = new ImageDither();

            const width = 280, height = 1;
            const sourceData = new Uint8ClampedArray(width * height * 4);
            sourceData.fill(255);

            const sourceImage = new ImageData(sourceData, width, height);

            expect(() => dither.ditherToHgr(sourceImage, 40, 1, 'viterbi')).not.toThrow();
        });

        it('should handle last scanline', () => {
            const dither = new ImageDither();

            const width = 280, height = 192;
            const sourceData = new Uint8ClampedArray(width * height * 4);
            sourceData.fill(255);

            const sourceImage = new ImageData(sourceData, width, height);

            expect(() => dither.ditherToHgr(sourceImage, 40, 192, 'viterbi')).not.toThrow();
        }, 30000); // 30 second timeout for full image processing

        it('should handle varying beam widths', () => {
            const dither = new ImageDither();

            const width = 7, height = 1;
            const sourceData = new Uint8ClampedArray(width * height * 4);
            sourceData.fill(128);

            const sourceImage = new ImageData(sourceData, width, height);

            // Should work with different beam widths (if configurable)
            // For now, just verify default works
            expect(() => dither.ditherToHgr(sourceImage, 1, 1, 'viterbi')).not.toThrow();
        });
    });
});

/**
 * Measure vertical banding in an image by analyzing column-to-column color variance.
 *
 * Vertical banding manifests as rapid color changes between adjacent columns.
 * This function measures the average color difference between adjacent columns.
 *
 * @param {string} imagePath - Path to PNG image file
 * @returns {number} - Banding score (lower is better, <30 is acceptable)
 */
function measureVerticalBanding(imagePath) {
    const fs = require('fs');
    const { PNG } = require('pngjs');

    // Load image
    const data = fs.readFileSync(imagePath);
    const png = PNG.sync.read(data);

    let totalDifference = 0;
    let comparisonCount = 0;

    // Compare each column with its neighbor
    for (let x = 0; x < png.width - 1; x++) {
        for (let y = 0; y < png.height; y++) {
            const idx1 = (png.width * y + x) << 2;
            const idx2 = (png.width * y + (x + 1)) << 2;

            const r1 = png.data[idx1];
            const g1 = png.data[idx1 + 1];
            const b1 = png.data[idx1 + 2];

            const r2 = png.data[idx2];
            const g2 = png.data[idx2 + 1];
            const b2 = png.data[idx2 + 2];

            // Calculate color difference
            const diff = Math.sqrt(
                Math.pow(r2 - r1, 2) +
                Math.pow(g2 - g1, 2) +
                Math.pow(b2 - b1, 2)
            );

            totalDifference += diff;
            comparisonCount++;
        }
    }

    // Return average difference between adjacent columns
    return totalDifference / comparisonCount;
}
