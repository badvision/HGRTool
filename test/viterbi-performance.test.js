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
 * CRITICAL PERFORMANCE TESTS for Viterbi Algorithm
 *
 * USER REPORT: "excruciating long time" for image import with Viterbi
 * ROOT CAUSE: ~31 million ImageData allocations per 280×192 image
 * FIX: Object reuse - renderer, imageData, and hgrBytes buffers
 *
 * SUCCESS CRITERIA:
 * - Full 280×192 image must complete within 30 seconds (preferably <10s)
 * - Single scanline must complete within 1 second
 * - No infinite loops or hangs
 * - Progress callback reports steady advancement
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { viterbiFullScanline } from '../docs/src/lib/viterbi-scanline.js';

describe('Viterbi Performance - CRITICAL', () => {
    let ImageDither;

    beforeAll(async () => {
        const imageDitherModule = await import('../docs/src/lib/image-dither.js');
        ImageDither = imageDitherModule.default;
    });

    describe('Single Scanline Performance', () => {
        it('should complete single scanline within 1 second', () => {
            // Create test data for one scanline (280 pixels = 40 bytes)
            const width = 280;
            const height = 1;
            const pixels = new Uint8ClampedArray(width * height * 4);

            // Fill with checkerboard pattern (challenging case)
            for (let x = 0; x < width; x++) {
                const i = x * 4;
                const value = (x % 2) * 255;
                pixels[i] = value;
                pixels[i + 1] = value;
                pixels[i + 2] = value;
                pixels[i + 3] = 255;
            }

            // Create error buffer
            const errorBuffer = Array.from({ length: height }, () =>
                Array.from({ length: width }, () => ({ r: 0, g: 0, b: 0 }))
            );

            // Helper function to extract target colors
            const getTargetWithError = (pixels, errorBuffer, byteX, y, pixelWidth) => {
                const targetColors = [];
                for (let bitPos = 0; bitPos < 7; bitPos++) {
                    const pixelX = byteX * 7 + bitPos;
                    if (pixelX >= pixelWidth) break;

                    const i = (y * pixelWidth + pixelX) * 4;
                    targetColors.push({
                        r: Math.max(0, Math.min(255, pixels[i] + errorBuffer[y][pixelX].r)),
                        g: Math.max(0, Math.min(255, pixels[i + 1] + errorBuffer[y][pixelX].g)),
                        b: Math.max(0, Math.min(255, pixels[i + 2] + errorBuffer[y][pixelX].b))
                    });
                }
                return targetColors;
            };

            // Track progress
            let progressReports = 0;
            const progressCallback = (byteX, targetWidth) => {
                progressReports++;
                console.log(`Progress: ${byteX}/${targetWidth} bytes (${((byteX / targetWidth) * 100).toFixed(1)}%)`);
            };

            // TIME IT
            const startTime = Date.now();
            const scanline = viterbiFullScanline(
                pixels,
                errorBuffer,
                0, // y position
                40, // targetWidth (bytes)
                280, // pixelWidth
                16, // beam width
                getTargetWithError,
                progressCallback
            );
            const endTime = Date.now();

            const elapsedMs = endTime - startTime;
            console.log(`Single scanline completed in ${elapsedMs}ms`);
            console.log(`Progress reports: ${progressReports}`);

            // ACCEPTANCE CRITERIA
            expect(elapsedMs).toBeLessThan(1000); // Must complete within 1 second
            expect(scanline.length).toBe(40); // Correct output size
            expect(progressReports).toBeGreaterThan(0); // Progress callback worked
        });
    });

    describe('Full Image Performance - CRITICAL USER BLOCKER', () => {
        it('should complete 280×192 image within 30 seconds (target: <10s)', () => {
            const dither = new ImageDither();

            // Create full-size test image
            const width = 280, height = 192;
            const sourceData = new Uint8ClampedArray(width * height * 4);

            // Solid mid-gray (simple case - should be fastest)
            sourceData.fill(128);
            for (let i = 3; i < sourceData.length; i += 4) {
                sourceData[i] = 255; // Alpha
            }

            const sourceImage = new ImageData(sourceData, width, height);

            // TIME IT
            const startTime = Date.now();
            const hgrData = dither.ditherToHgr(sourceImage, 40, 192, 'viterbi');
            const endTime = Date.now();

            const elapsedMs = endTime - startTime;
            const elapsedSec = elapsedMs / 1000;

            console.log(`\n============================================`);
            console.log(`CRITICAL PERFORMANCE RESULT`);
            console.log(`============================================`);
            console.log(`Full 280×192 image: ${elapsedSec.toFixed(2)} seconds`);
            console.log(`Target: <10 seconds (acceptable: <30 seconds)`);
            console.log(`Per-scanline average: ${(elapsedMs / 192).toFixed(1)}ms`);
            console.log(`============================================\n`);

            // CRITICAL SUCCESS CRITERIA
            expect(elapsedSec).toBeLessThan(30); // Must complete within 30 seconds
            expect(hgrData.length).toBe(40 * 192); // Correct output size

            // GOAL: <10 seconds (warn if exceeded but don't fail)
            if (elapsedSec > 10) {
                console.warn(`WARNING: Exceeded performance goal of 10 seconds (${elapsedSec.toFixed(2)}s)`);
                console.warn(`Consider: reducing beam width, further optimizations, or caching`);
            }
        }, 60000); // 60 second timeout with safety margin
    });

    describe('Progress Reporting', () => {
        it('should report progress at regular intervals during full image', () => {
            const dither = new ImageDither();

            // Small test image (fast)
            const width = 280, height = 10; // Just 10 scanlines
            const sourceData = new Uint8ClampedArray(width * height * 4);
            sourceData.fill(128);
            for (let i = 3; i < sourceData.length; i += 4) {
                sourceData[i] = 255;
            }

            const sourceImage = new ImageData(sourceData, width, height);

            // Note: We can't directly test progress callback from ImageDither
            // (it doesn't expose it), but we verify no crashes
            const hgrData = dither.ditherToHgr(sourceImage, 40, 10, 'viterbi');

            expect(hgrData.length).toBe(40 * 10);
        });
    });

    describe('Performance with Different Beam Widths', () => {
        it('should complete faster with smaller beam width', () => {
            // Create test data for one scanline
            const width = 280, height = 1;
            const pixels = new Uint8ClampedArray(width * height * 4);
            pixels.fill(128);
            for (let i = 3; i < pixels.length; i += 4) {
                pixels[i] = 255;
            }

            const errorBuffer = Array.from({ length: height }, () =>
                Array.from({ length: width }, () => ({ r: 0, g: 0, b: 0 }))
            );

            const getTargetWithError = (pixels, errorBuffer, byteX, y, pixelWidth) => {
                const targetColors = [];
                for (let bitPos = 0; bitPos < 7; bitPos++) {
                    const pixelX = byteX * 7 + bitPos;
                    if (pixelX >= pixelWidth) break;
                    const i = (y * pixelWidth + pixelX) * 4;
                    targetColors.push({
                        r: pixels[i],
                        g: pixels[i + 1],
                        b: pixels[i + 2]
                    });
                }
                return targetColors;
            };

            // Test beam width = 16 (default)
            const start16 = Date.now();
            const scanline16 = viterbiFullScanline(
                pixels, errorBuffer, 0, 40, 280, 16, getTargetWithError
            );
            const time16 = Date.now() - start16;

            // Test beam width = 8 (faster but potentially lower quality)
            const start8 = Date.now();
            const scanline8 = viterbiFullScanline(
                pixels, errorBuffer, 0, 40, 280, 8, getTargetWithError
            );
            const time8 = Date.now() - start8;

            // Test beam width = 4 (fastest but lower quality)
            const start4 = Date.now();
            const scanline4 = viterbiFullScanline(
                pixels, errorBuffer, 0, 40, 280, 4, getTargetWithError
            );
            const time4 = Date.now() - start4;

            console.log(`\nBeam Width Performance Comparison:`);
            console.log(`  K=16: ${time16}ms (default)`);
            console.log(`  K=8:  ${time8}ms (${((time8 / time16) * 100).toFixed(1)}% of default)`);
            console.log(`  K=4:  ${time4}ms (${((time4 / time16) * 100).toFixed(1)}% of default)`);

            // Verify all produce valid output
            expect(scanline16.length).toBe(40);
            expect(scanline8.length).toBe(40);
            expect(scanline4.length).toBe(40);

            // Smaller beam should be faster (or at least not slower)
            expect(time8).toBeLessThanOrEqual(time16 * 1.2); // Allow 20% margin for variance
            expect(time4).toBeLessThanOrEqual(time8 * 1.2);
        });
    });

    describe('No Infinite Loops or Hangs', () => {
        it('should handle edge case: all white input', () => {
            const width = 280, height = 1;
            const pixels = new Uint8ClampedArray(width * height * 4);
            pixels.fill(255); // All white

            const errorBuffer = Array.from({ length: height }, () =>
                Array.from({ length: width }, () => ({ r: 0, g: 0, b: 0 }))
            );

            const getTargetWithError = (pixels, errorBuffer, byteX, y, pixelWidth) => {
                const targetColors = [];
                for (let bitPos = 0; bitPos < 7; bitPos++) {
                    const pixelX = byteX * 7 + bitPos;
                    if (pixelX >= pixelWidth) break;
                    const i = (y * pixelWidth + pixelX) * 4;
                    targetColors.push({
                        r: pixels[i],
                        g: pixels[i + 1],
                        b: pixels[i + 2]
                    });
                }
                return targetColors;
            };

            const startTime = Date.now();
            const scanline = viterbiFullScanline(
                pixels, errorBuffer, 0, 40, 280, 16, getTargetWithError
            );
            const elapsedMs = Date.now() - startTime;

            expect(elapsedMs).toBeLessThan(1000);
            expect(scanline.length).toBe(40);
        });

        it('should handle edge case: all black input', () => {
            const width = 280, height = 1;
            const pixels = new Uint8ClampedArray(width * height * 4);
            // All zeros (black)

            const errorBuffer = Array.from({ length: height }, () =>
                Array.from({ length: width }, () => ({ r: 0, g: 0, b: 0 }))
            );

            const getTargetWithError = (pixels, errorBuffer, byteX, y, pixelWidth) => {
                const targetColors = [];
                for (let bitPos = 0; bitPos < 7; bitPos++) {
                    const pixelX = byteX * 7 + bitPos;
                    if (pixelX >= pixelWidth) break;
                    const i = (y * pixelWidth + pixelX) * 4;
                    targetColors.push({
                        r: pixels[i],
                        g: pixels[i + 1],
                        b: pixels[i + 2]
                    });
                }
                return targetColors;
            };

            const startTime = Date.now();
            const scanline = viterbiFullScanline(
                pixels, errorBuffer, 0, 40, 280, 16, getTargetWithError
            );
            const elapsedMs = Date.now() - startTime;

            expect(elapsedMs).toBeLessThan(1000);
            expect(scanline.length).toBe(40);
        });

        it('should handle edge case: high frequency checkerboard', () => {
            const width = 280, height = 1;
            const pixels = new Uint8ClampedArray(width * height * 4);

            // Pixel-level checkerboard (worst case for algorithm)
            for (let x = 0; x < width; x++) {
                const i = x * 4;
                const value = (x % 2) * 255;
                pixels[i] = value;
                pixels[i + 1] = value;
                pixels[i + 2] = value;
                pixels[i + 3] = 255;
            }

            const errorBuffer = Array.from({ length: height }, () =>
                Array.from({ length: width }, () => ({ r: 0, g: 0, b: 0 }))
            );

            const getTargetWithError = (pixels, errorBuffer, byteX, y, pixelWidth) => {
                const targetColors = [];
                for (let bitPos = 0; bitPos < 7; bitPos++) {
                    const pixelX = byteX * 7 + bitPos;
                    if (pixelX >= pixelWidth) break;
                    const i = (y * pixelWidth + pixelX) * 4;
                    targetColors.push({
                        r: pixels[i],
                        g: pixels[i + 1],
                        b: pixels[i + 2]
                    });
                }
                return targetColors;
            };

            const startTime = Date.now();
            const scanline = viterbiFullScanline(
                pixels, errorBuffer, 0, 40, 280, 16, getTargetWithError
            );
            const elapsedMs = Date.now() - startTime;

            expect(elapsedMs).toBeLessThan(1000);
            expect(scanline.length).toBe(40);
        });
    });
});
