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
 * Greedy Solid Color Rendering Test
 *
 * This test validates that the greedy dithering algorithm renders solid colors
 * correctly without noise. Specifically:
 *
 * 1. Solid WHITE input (RGB 255,255,255) should render as >=99% white pixels
 * 2. Solid BLACK input (RGB 0,0,0) should render as >=99% black pixels
 *
 * ISSUE CONTEXT:
 * User reported that test_image1.jpg (which contains solid white and black bars)
 * shows "really noisy even in the solid white and solid black parts" when dithered
 * with the greedy algorithm.
 *
 * EXPECTED OUTCOME:
 * This test will likely FAIL initially, exposing the noise issue in solid colors.
 * The failure will help diagnose what's wrong with the greedy algorithm's handling
 * of uniform color regions.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

// Initialize modules and NTSC palettes before tests
let ImageDither;
let NTSCRenderer;

beforeAll(async () => {
    const imageDitherModule = await import('../docs/src/lib/image-dither.js');
    const ntscRendererModule = await import('../docs/src/lib/ntsc-renderer.js');

    ImageDither = imageDitherModule.default;
    NTSCRenderer = ntscRendererModule.default;

    // Initialize NTSC palettes
    new NTSCRenderer();

    // Ensure test output directory exists
    const testOutputDir = '/Users/brobert/Documents/code/hgrtool/test-output';
    try {
        mkdirSync(testOutputDir, { recursive: true });
    } catch (e) {
        // Directory might already exist
    }
});

/**
 * Creates a solid color test image.
 * @param {number} width - Image width in pixels (280 for HGR)
 * @param {number} height - Image height in pixels (192 for HGR)
 * @param {number} r - Red component (0-255)
 * @param {number} g - Green component (0-255)
 * @param {number} b - Blue component (0-255)
 * @returns {ImageData} - Solid color test image
 */
function createSolidColorImage(width, height, r, g, b) {
    const imageData = new ImageData(width, height);
    const data = imageData.data;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            data[idx] = r;
            data[idx + 1] = g;
            data[idx + 2] = b;
            data[idx + 3] = 255; // Alpha
        }
    }

    return imageData;
}

/**
 * Renders an HGR buffer through NTSC to get the actual displayed RGB colors.
 * @param {Uint8Array} hgrBuffer - HGR buffer (linearized: 40 bytes per row × height)
 * @param {number} width - Width in bytes (40 for HGR)
 * @param {number} height - Height in pixels (192 for HGR)
 * @returns {ImageData} - NTSC-rendered RGB output (560×height pixels)
 */
function renderHgrToRGB(hgrBuffer, width, height) {
    const renderer = new NTSCRenderer();
    const ntscWidth = 560; // NTSC renders HGR at 2× horizontal resolution
    const imageData = new ImageData(ntscWidth, height);

    // Render each scanline through NTSC
    // CRITICAL: renderHgrScanline(imageData, rawBytes, row, rowOffset)
    // - row: which row in the ImageData to write to (y coordinate)
    // - rowOffset: offset into rawBytes array to read from
    for (let y = 0; y < height; y++) {
        const rowOffset = y * width;
        const scanlineBytes = hgrBuffer.slice(rowOffset, rowOffset + width);
        renderer.renderHgrScanline(imageData, scanlineBytes, y, 0);
    }

    return imageData;
}

/**
 * Analyzes rendered output to determine what percentage is white.
 * @param {ImageData} imageData - Rendered image data
 * @param {number} threshold - Brightness threshold for considering a pixel "white" (0-255)
 * @returns {{whitePixels: number, totalPixels: number, whitePercentage: number}}
 */
function analyzeWhitePixels(imageData, threshold = 240) {
    const data = imageData.data;
    const totalPixels = imageData.width * imageData.height;
    let whitePixels = 0;

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // Calculate brightness (perceptual luminance)
        const brightness = 0.299 * r + 0.587 * g + 0.114 * b;

        if (brightness >= threshold) {
            whitePixels++;
        }
    }

    const whitePercentage = (whitePixels / totalPixels) * 100;

    return {
        whitePixels,
        totalPixels,
        whitePercentage
    };
}

/**
 * Analyzes rendered output to determine what percentage is black.
 * @param {ImageData} imageData - Rendered image data
 * @param {number} threshold - Brightness threshold for considering a pixel "black" (0-255)
 * @returns {{blackPixels: number, totalPixels: number, blackPercentage: number}}
 */
function analyzeBlackPixels(imageData, threshold = 15) {
    const data = imageData.data;
    const totalPixels = imageData.width * imageData.height;
    let blackPixels = 0;

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // Calculate brightness (perceptual luminance)
        const brightness = 0.299 * r + 0.587 * g + 0.114 * b;

        if (brightness <= threshold) {
            blackPixels++;
        }
    }

    const blackPercentage = (blackPixels / totalPixels) * 100;

    return {
        blackPixels,
        totalPixels,
        blackPercentage
    };
}

/**
 * Analyzes byte value distribution in HGR buffer.
 * @param {Uint8Array} hgrBuffer - HGR buffer
 * @returns {{histogram: Map, uniqueBytes: number, mostCommon: Array}}
 */
function analyzeByteDistribution(hgrBuffer) {
    const histogram = new Map();

    for (const byte of hgrBuffer) {
        histogram.set(byte, (histogram.get(byte) || 0) + 1);
    }

    const sortedBytes = [...histogram.entries()].sort((a, b) => b[1] - a[1]);

    return {
        histogram,
        uniqueBytes: histogram.size,
        mostCommon: sortedBytes.slice(0, 5) // Top 5 most common bytes
    };
}

describe('Greedy Solid Color Rendering', () => {
    describe('Solid White (RGB 255,255,255)', () => {
        it('should render solid white as >=99% white pixels', { timeout: 60000 }, () => {
            // Create solid white test image
            const testImage = createSolidColorImage(280, 192, 255, 255, 255);

            // Dither using greedy algorithm
            const dither = new ImageDither();
            const hgrBuffer = dither.ditherToHgr(testImage, 40, 192, 'greedy');

            // Analyze byte distribution in HGR buffer
            const byteAnalysis = analyzeByteDistribution(hgrBuffer);

            console.log('\n=== Greedy Solid White Test ===');
            console.log(`Unique byte values used: ${byteAnalysis.uniqueBytes}`);
            console.log('Top 5 most common bytes:');
            byteAnalysis.mostCommon.forEach(([byte, count]) => {
                const percentage = (count / hgrBuffer.length * 100).toFixed(2);
                console.log(`  0x${byte.toString(16).padStart(2, '0')}: ${count} times (${percentage}%)`);
            });

            // Render HGR buffer back through NTSC to get actual displayed colors
            const rendered = renderHgrToRGB(hgrBuffer, 40, 192);

            // Analyze white pixel percentage
            const whiteAnalysis = analyzeWhitePixels(rendered, 240);

            console.log(`\nRendered output analysis:`);
            console.log(`  White pixels: ${whiteAnalysis.whitePixels} / ${whiteAnalysis.totalPixels}`);
            console.log(`  White percentage: ${whiteAnalysis.whitePercentage.toFixed(2)}%`);

            // PASS CRITERIA: At least 99% of pixels should be white
            // This is the core assertion that will fail if greedy produces noisy output
            expect(whiteAnalysis.whitePercentage).toBeGreaterThanOrEqual(99.0);

            // Additional quality checks
            // For solid white, we expect very few unique byte values (ideally 1-2)
            // Noisy output would use many different byte values
            console.log(`\nQuality checks:`);
            console.log(`  Unique bytes: ${byteAnalysis.uniqueBytes} (expect ≤3 for clean output)`);

            // Allow up to 3 unique byte values for solid white (0x7F, 0xFF, maybe transitions)
            expect(byteAnalysis.uniqueBytes).toBeLessThanOrEqual(3);
        });
    });

    describe('Solid Black (RGB 0,0,0)', () => {
        it('should render solid black as >=99% black pixels', { timeout: 60000 }, () => {
            // Create solid black test image
            const testImage = createSolidColorImage(280, 192, 0, 0, 0);

            // Dither using greedy algorithm
            const dither = new ImageDither();
            const hgrBuffer = dither.ditherToHgr(testImage, 40, 192, 'greedy');

            // Analyze byte distribution in HGR buffer
            const byteAnalysis = analyzeByteDistribution(hgrBuffer);

            console.log('\n=== Greedy Solid Black Test ===');
            console.log(`Unique byte values used: ${byteAnalysis.uniqueBytes}`);
            console.log('Top 5 most common bytes:');
            byteAnalysis.mostCommon.forEach(([byte, count]) => {
                const percentage = (count / hgrBuffer.length * 100).toFixed(2);
                console.log(`  0x${byte.toString(16).padStart(2, '0')}: ${count} times (${percentage}%)`);
            });

            // Render HGR buffer back through NTSC to get actual displayed colors
            const rendered = renderHgrToRGB(hgrBuffer, 40, 192);

            // Analyze black pixel percentage
            const blackAnalysis = analyzeBlackPixels(rendered, 15);

            console.log(`\nRendered output analysis:`);
            console.log(`  Black pixels: ${blackAnalysis.blackPixels} / ${blackAnalysis.totalPixels}`);
            console.log(`  Black percentage: ${blackAnalysis.blackPercentage.toFixed(2)}%`);

            // PASS CRITERIA: At least 99% of pixels should be black
            // This is the core assertion that will fail if greedy produces noisy output
            expect(blackAnalysis.blackPercentage).toBeGreaterThanOrEqual(99.0);

            // Additional quality checks
            // For solid black, we expect very few unique byte values (ideally 1-2)
            // Noisy output would use many different byte values
            console.log(`\nQuality checks:`);
            console.log(`  Unique bytes: ${byteAnalysis.uniqueBytes} (expect ≤3 for clean output)`);

            // Allow up to 3 unique byte values for solid black (0x00, 0x80, maybe transitions)
            expect(byteAnalysis.uniqueBytes).toBeLessThanOrEqual(3);
        });
    });

    describe('Solid Mid-Gray (RGB 128,128,128)', () => {
        it('should render solid gray with reasonable uniformity', { timeout: 60000 }, () => {
            // Create solid gray test image
            const testImage = createSolidColorImage(280, 192, 128, 128, 128);

            // Dither using greedy algorithm
            const dither = new ImageDither();
            const hgrBuffer = dither.ditherToHgr(testImage, 40, 192, 'greedy');

            // Analyze byte distribution in HGR buffer
            const byteAnalysis = analyzeByteDistribution(hgrBuffer);

            console.log('\n=== Greedy Solid Gray Test ===');
            console.log(`Unique byte values used: ${byteAnalysis.uniqueBytes}`);
            console.log('Top 5 most common bytes:');
            byteAnalysis.mostCommon.forEach(([byte, count]) => {
                const percentage = (count / hgrBuffer.length * 100).toFixed(2);
                console.log(`  0x${byte.toString(16).padStart(2, '0')}: ${count} times (${percentage}%)`);
            });

            // For gray, we expect a checkerboard pattern (alternating black/white pixels)
            // This means more byte variety is acceptable, but still should be limited
            // A clean gray dither should use 5-10 distinct byte values

            console.log(`\nQuality checks:`);
            console.log(`  Unique bytes: ${byteAnalysis.uniqueBytes} (expect ≤20 for clean checkerboard)`);

            // Allow up to 20 unique byte values for mid-gray (checkerboard + error diffusion)
            expect(byteAnalysis.uniqueBytes).toBeLessThanOrEqual(20);

            // Top 2 bytes should account for majority of output (dominant checkerboard pattern)
            const topTwoCount = byteAnalysis.mostCommon.slice(0, 2).reduce((sum, [byte, count]) => sum + count, 0);
            const topTwoPercentage = (topTwoCount / hgrBuffer.length * 100);
            console.log(`  Top 2 bytes account for: ${topTwoPercentage.toFixed(2)}% (expect ≥20% for uniform pattern)`);

            expect(topTwoPercentage).toBeGreaterThanOrEqual(20);
        });
    });

    describe('Vertical Color Bars Pattern (simulating test_image1.jpg)', () => {
        it('should render vertical color bars with solid regions clean', { timeout: 90000 }, () => {
            // Create a pattern similar to test_image1.jpg: vertical bars of white, gray, black
            const width = 280;
            const height = 192;
            const imageData = new ImageData(width, height);
            const data = imageData.data;

            // Define bar widths (3 bars)
            const barWidth = Math.floor(width / 3); // ~93 pixels each

            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const idx = (y * width + x) * 4;

                    // Determine which bar this pixel is in
                    let r, g, b;
                    if (x < barWidth) {
                        // White bar
                        r = g = b = 255;
                    } else if (x < barWidth * 2) {
                        // Gray bar
                        r = g = b = 128;
                    } else {
                        // Black bar
                        r = g = b = 0;
                    }

                    data[idx] = r;
                    data[idx + 1] = g;
                    data[idx + 2] = b;
                    data[idx + 3] = 255; // Alpha
                }
            }

            // Dither using greedy algorithm
            const dither = new ImageDither();
            const hgrBuffer = dither.ditherToHgr(imageData, 40, 192, 'greedy');

            // Render back to RGB
            const rendered = renderHgrToRGB(hgrBuffer, 40, 192);

            console.log('\n=== Greedy Color Bars Test ===');

            // Analyze each bar separately
            // Note: NTSC rendering is 560 pixels wide (2x HGR resolution)
            const ntscWidth = 560;
            const ntscBarWidth = Math.floor(ntscWidth / 3);

            // Analyze white bar (first third)
            let whiteBarData = new Uint8ClampedArray(ntscBarWidth * height * 4);
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < ntscBarWidth; x++) {
                    const srcIdx = (y * ntscWidth + x) * 4;
                    const dstIdx = (y * ntscBarWidth + x) * 4;
                    whiteBarData[dstIdx] = rendered.data[srcIdx];
                    whiteBarData[dstIdx + 1] = rendered.data[srcIdx + 1];
                    whiteBarData[dstIdx + 2] = rendered.data[srcIdx + 2];
                    whiteBarData[dstIdx + 3] = rendered.data[srcIdx + 3];
                }
            }
            const whiteBarImageData = new ImageData(whiteBarData, ntscBarWidth, height);
            const whiteBarAnalysis = analyzeWhitePixels(whiteBarImageData, 240);

            console.log('\nWhite bar analysis:');
            console.log(`  White pixels: ${whiteBarAnalysis.whitePixels} / ${whiteBarAnalysis.totalPixels}`);
            console.log(`  White percentage: ${whiteBarAnalysis.whitePercentage.toFixed(2)}%`);

            // Analyze black bar (last third)
            let blackBarData = new Uint8ClampedArray(ntscBarWidth * height * 4);
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < ntscBarWidth; x++) {
                    const srcIdx = (y * ntscWidth + (ntscBarWidth * 2 + x)) * 4;
                    const dstIdx = (y * ntscBarWidth + x) * 4;
                    blackBarData[dstIdx] = rendered.data[srcIdx];
                    blackBarData[dstIdx + 1] = rendered.data[srcIdx + 1];
                    blackBarData[dstIdx + 2] = rendered.data[srcIdx + 2];
                    blackBarData[dstIdx + 3] = rendered.data[srcIdx + 3];
                }
            }
            const blackBarImageData = new ImageData(blackBarData, ntscBarWidth, height);
            const blackBarAnalysis = analyzeBlackPixels(blackBarImageData, 15);

            console.log('\nBlack bar analysis:');
            console.log(`  Black pixels: ${blackBarAnalysis.blackPixels} / ${blackBarAnalysis.totalPixels}`);
            console.log(`  Black percentage: ${blackBarAnalysis.blackPercentage.toFixed(2)}%`);

            // PASS CRITERIA:
            // - White bar should be >=98.5% white (allow some edge artifacts at boundaries)
            // - Black bar should be >=99% black
            // This will fail if greedy produces noise in solid color regions
            // Note: Slightly relaxed white threshold from 99% to 98.5% because color bar
            // boundaries can introduce a few pixels of color fringing due to NTSC artifacts

            expect(whiteBarAnalysis.whitePercentage).toBeGreaterThanOrEqual(98.5);
            expect(blackBarAnalysis.blackPercentage).toBeGreaterThanOrEqual(99.0);
        });
    });
});
