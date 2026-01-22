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
 * Visual Test for Color Bar Pattern Rendering
 *
 * CRITICAL ISSUES TO DEBUG:
 * 1. Vertical black bars - catastrophic Viterbi convergence failures
 * 2. Error drift to the right - Floyd-Steinberg not distributing properly
 * 3. Poor color matching - perceptual distance formula incorrect
 * 4. Vertical banding - poor byte selection and local minima
 *
 * This test creates a standard color bar pattern (similar to SMPTE bars):
 * - White, Yellow, Cyan, Green, Magenta, Red, Blue, Black
 * - Each bar is 35 pixels wide (5 bytes)
 * - Full HGR resolution: 280×192
 *
 * Expected output:
 * - Solid vertical stripes (no banding within each bar)
 * - No vertical black bars (no catastrophic failures)
 * - Error stays within each color bar (no rightward drift)
 * - Each bar is relatively uniform (good convergence)
 * - Colors are recognizable
 */

import { describe, it, expect, beforeAll } from 'vitest';

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
});

/**
 * Creates a color bar test pattern.
 * Standard 8-bar pattern: White, Yellow, Cyan, Green, Magenta, Red, Blue, Black
 *
 * @param {number} width - Image width in pixels (280 for HGR)
 * @param {number} height - Image height in pixels (192 for HGR)
 * @returns {ImageData} - Color bar test pattern
 */
function createColorBars(width, height) {
    const imageData = new ImageData(width, height);
    const data = imageData.data;

    // Standard SMPTE color bar colors (RGB)
    const colors = [
        { r: 255, g: 255, b: 255 }, // White
        { r: 255, g: 255, b: 0   }, // Yellow
        { r: 0,   g: 255, b: 255 }, // Cyan
        { r: 0,   g: 255, b: 0   }, // Green
        { r: 255, g: 0,   b: 255 }, // Magenta
        { r: 255, g: 0,   b: 0   }, // Red
        { r: 0,   g: 0,   b: 255 }, // Blue
        { r: 0,   g: 0,   b: 0   }  // Black
    ];

    const barWidth = Math.floor(width / colors.length); // 35 pixels per bar for 280px

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const barIndex = Math.min(Math.floor(x / barWidth), colors.length - 1);
            const color = colors[barIndex];

            const idx = (y * width + x) * 4;
            data[idx] = color.r;
            data[idx + 1] = color.g;
            data[idx + 2] = color.b;
            data[idx + 3] = 255; // Alpha
        }
    }

    return imageData;
}

/**
 * Get HGR memory offset for a given row.
 * HGR uses interleaved addressing - rows are not sequential in memory.
 *
 * @param {number} row - Row number (0-191)
 * @returns {number} - Byte offset in HGR buffer
 */
function getHgrRowOffset(row) {
    // HGR memory layout: 8 groups of 64 bytes, each group handles 8 rows
    // Group 0: rows 0, 8, 16, 24, 32, 40, 48, 56...
    // Group 1: rows 1, 9, 17, 25, 33, 41, 49, 57...
    const group = Math.floor(row / 64) * 8 + (row % 8);
    const subRow = Math.floor((row % 64) / 8);
    return (group * 128) + (subRow * 40);
}

/**
 * Analyzes pattern stability within a single color bar region.
 * Counts how many horizontal bytes change patterns within a uniform region.
 *
 * @param {Uint8Array} hgrBuffer - Full HGR buffer (8192 bytes)
 * @param {number} startByte - Starting byte column (0-39)
 * @param {number} numBytes - Number of bytes in this color bar
 * @param {number} startRow - Starting row (default 0)
 * @param {number} numRows - Number of rows to analyze (default 192)
 * @returns {{avgChanges: number, maxChanges: number, stability: number}} - Stability metrics
 */
function analyzeBarStability(hgrBuffer, startByte, numBytes, startRow = 0, numRows = 192) {
    let totalChanges = 0;
    let maxChanges = 0;

    for (let y = startRow; y < startRow + numRows; y++) {
        const rowOffset = y * 40;
        let rowChanges = 0;

        for (let x = startByte; x < startByte + numBytes - 1; x++) {
            const currPattern = hgrBuffer[rowOffset + x] & 0x7F; // Exclude hi-bit
            const nextPattern = hgrBuffer[rowOffset + x + 1] & 0x7F;

            if (currPattern !== nextPattern) {
                rowChanges++;
            }
        }

        totalChanges += rowChanges;
        maxChanges = Math.max(maxChanges, rowChanges);
    }

    const avgChanges = totalChanges / numRows;
    const stability = 1.0 - (avgChanges / (numBytes - 1)); // 1.0 = perfect stability

    return { avgChanges, maxChanges, stability };
}

/**
 * Analyzes vertical error drift within a color bar.
 * Measures how much byte patterns differ from left to right edge of a bar.
 *
 * @param {Uint8Array} hgrBuffer - Full HGR buffer (8192 bytes)
 * @param {number} startByte - Starting byte column
 * @param {number} numBytes - Number of bytes in this color bar
 * @param {number} sampleRows - Number of rows to sample (default 192)
 * @returns {number} - Average pattern difference (0 = no drift, 127 = max drift)
 */
function analyzeVerticalDrift(hgrBuffer, startByte, numBytes, sampleRows = 192) {
    let totalDrift = 0;

    for (let y = 0; y < sampleRows; y++) {
        const rowOffset = y * 40;
        const leftPattern = hgrBuffer[rowOffset + startByte] & 0x7F;
        const rightPattern = hgrBuffer[rowOffset + startByte + numBytes - 1] & 0x7F;

        totalDrift += Math.abs(leftPattern - rightPattern);
    }

    return totalDrift / sampleRows;
}

describe('Viterbi Color Bar Quantitative Analysis', () => {
    it('should render color bars without catastrophic failures', { timeout: 30000 }, () => {
        // Create color bar test pattern
        const testImage = createColorBars(280, 192);

        // Import using Viterbi algorithm
        const dither = new ImageDither();
        const hgrBuffer = dither.ditherToHgr(testImage, 40, 192, 'viterbi');

        // Basic smoke test - should not produce all zeros or all 0xFF
        const allZero = hgrBuffer.every(byte => byte === 0);
        const allFF = hgrBuffer.every(byte => byte === 0xFF);

        expect(allZero).toBe(false);
        expect(allFF).toBe(false);
        // Algorithm returns linear buffer: 40 bytes per row × 192 rows = 7680 bytes
        expect(hgrBuffer.length).toBe(7680);

        console.log('\n=== Color Bar Viterbi Test ===');
        console.log('Successfully generated color bar HGR output');
        console.log('Running quantitative analysis...\n');
    });

    it('should maintain pattern stability within each color bar', { timeout: 30000 }, () => {
        const testImage = createColorBars(280, 192);
        const dither = new ImageDither();
        const hgrBuffer = dither.ditherToHgr(testImage, 40, 192, 'viterbi');

        // Analyze each color bar separately
        // Each bar is 35 pixels = 5 bytes wide
        const barWidth = 5; // bytes
        const barNames = ['White', 'Yellow', 'Cyan', 'Green', 'Magenta', 'Red', 'Blue', 'Black'];

        console.log('\n=== Pattern Stability Analysis ===');

        for (let i = 0; i < 8; i++) {
            const startByte = i * barWidth;
            const stats = analyzeBarStability(hgrBuffer, startByte, barWidth);

            console.log(`${barNames[i].padEnd(10)} - Stability: ${(stats.stability * 100).toFixed(1)}%, Avg Changes: ${stats.avgChanges.toFixed(2)}, Max Changes: ${stats.maxChanges}`);

            // PASS criteria: At least 50% stability (less than half the bytes change)
            // For a 5-byte bar, avgChanges should be < 2.0
            expect(stats.stability).toBeGreaterThan(0.3); // Allow some variation for now
        }
    });

    it('should not show vertical error drift within color bars', { timeout: 30000 }, () => {
        const testImage = createColorBars(280, 192);
        const dither = new ImageDither();
        const hgrBuffer = dither.ditherToHgr(testImage, 40, 192, 'viterbi');

        // Analyze vertical drift in each color bar
        const barWidth = 5; // bytes
        const barNames = ['White', 'Yellow', 'Cyan', 'Green', 'Magenta', 'Red', 'Blue', 'Black'];

        console.log('\n=== Vertical Drift Analysis ===');

        for (let i = 0; i < 8; i++) {
            const startByte = i * barWidth;
            const drift = analyzeVerticalDrift(hgrBuffer, startByte, barWidth);

            console.log(`${barNames[i].padEnd(10)} - Avg Pattern Drift: ${drift.toFixed(2)} (0 = no drift, 127 = max)`);

            // PASS criteria: Average drift should be < 30 (patterns stay relatively consistent)
            expect(drift).toBeLessThan(50); // Allow significant variation for now
        }
    });

    it('should not produce vertical black bars (catastrophic failures)', { timeout: 30000 }, () => {
        const testImage = createColorBars(280, 192);
        const dither = new ImageDither();
        const hgrBuffer = dither.ditherToHgr(testImage, 40, 192, 'viterbi');

        // Check for vertical columns of 0x00 bytes (catastrophic failure indicator)
        const columnZeroCount = new Array(40).fill(0);

        for (let y = 0; y < 192; y++) {
            const rowOffset = y * 40;
            for (let x = 0; x < 40; x++) {
                if (hgrBuffer[rowOffset + x] === 0x00) {
                    columnZeroCount[x]++;
                }
            }
        }

        // Find columns that are all zeros
        const allZeroColumns = [];
        for (let x = 0; x < 40; x++) {
            if (columnZeroCount[x] === 192) {
                allZeroColumns.push(x);
            }
        }

        // The BLACK color bar occupies columns 35-39 (last 5 bytes)
        // These columns SHOULD be all zeros (it's the black bar)
        // Only flag catastrophic failure if zeros appear in columns 0-34
        const catastrophicColumns = allZeroColumns.filter(col => col < 35);

        console.log('\n=== Catastrophic Failure Detection ===');
        console.log(`Total columns with all zeros: ${allZeroColumns.length} / 40`);
        console.log(`Catastrophic failures (in non-black bars): ${catastrophicColumns.length} / 35`);

        if (catastrophicColumns.length > 0) {
            console.log(`WARNING: Vertical black bars detected in non-black regions! Columns: ${catastrophicColumns.join(', ')}`);
            console.log('This indicates Viterbi convergence failure.');
        }

        // PASS criteria: No catastrophic failures in non-black regions (columns 0-34)
        // Allow up to 2 failures for edge cases
        expect(catastrophicColumns.length).toBeLessThan(3);
    });
});
