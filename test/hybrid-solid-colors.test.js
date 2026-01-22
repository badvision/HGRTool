/*
 * Hybrid Algorithm Solid Color Tests
 *
 * REQUIREMENT: Solid colors from NTSC palette should produce SOLID output.
 * If a test image is filled with a single HGR-displayable color, the dithering
 * algorithm MUST produce uniform byte patterns (all same byte or minimal variation).
 *
 * These tests verify the hybrid algorithm produces solid output for:
 * - Orange (hi-bit 1, blue/orange palette)
 * - Blue (hi-bit 1, blue/orange palette)
 * - Purple (hi-bit 0, purple/green palette)
 * - Green (hi-bit 0, purple/green palette)
 * - Black (grayscale)
 * - White (grayscale)
 */

import { describe, it, expect, beforeAll } from 'vitest';

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
 * Create a solid color test image.
 */
function createSolidColorImage(width, height, color) {
    const imageData = new ImageData(width, height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
        data[i] = color.r;
        data[i + 1] = color.g;
        data[i + 2] = color.b;
        data[i + 3] = 255;
    }

    return imageData;
}

/**
 * Count unique byte patterns (excluding hi-bit) in output.
 * For solid colors, we expect only 1 or 2 patterns max.
 */
function countUniquePatterns(hgrBytes) {
    const patterns = new Set();
    for (let i = 0; i < hgrBytes.length; i++) {
        patterns.add(hgrBytes[i] & 0x7F); // Exclude hi-bit
    }
    return patterns.size;
}

/**
 * Check if output is predominantly one byte value.
 * Returns percentage of bytes matching the most common value.
 */
function calculateUniformity(hgrBytes) {
    const counts = new Map();
    let maxCount = 0;
    let total = 0;

    for (let i = 0; i < hgrBytes.length; i++) {
        const byte = hgrBytes[i];
        const count = (counts.get(byte) || 0) + 1;
        counts.set(byte, count);
        maxCount = Math.max(maxCount, count);
        total++;
    }

    return (maxCount / total) * 100;
}

/**
 * Get byte pattern frequency distribution.
 * Returns array of [byte, count, percentage] sorted by count descending.
 */
function getByteDistribution(hgrBytes, topN = 10) {
    const counts = new Map();

    for (let i = 0; i < hgrBytes.length; i++) {
        const byte = hgrBytes[i];
        counts.set(byte, (counts.get(byte) || 0) + 1);
    }

    const total = hgrBytes.length;
    const distribution = Array.from(counts.entries())
        .map(([byte, count]) => ({
            byte: `0x${byte.toString(16).toUpperCase().padStart(2, '0')}`,
            pattern: `0x${(byte & 0x7F).toString(16).toUpperCase().padStart(2, '0')}`,
            hiBit: (byte & 0x80) ? 1 : 0,
            count,
            percent: ((count / total) * 100).toFixed(1)
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, topN);

    return distribution;
}

describe('Hybrid Algorithm - Solid Color Tests', () => {
    describe('Orange (Hi-Bit 1 Palette)', () => {
        it('should produce solid output for pure orange', () => {
            const ditherer = new ImageDither();
            // Use actual NTSC-rendered color from byte 0xAA
            const orangeColor = { r: 116, g: 116, b: 73 };
            const sourceImage = createSolidColorImage(280, 192, orangeColor);

            const hgrBytes = ditherer.ditherToHgr(sourceImage, 40, 192, 'hybrid');

            // Count unique patterns
            const uniquePatterns = countUniquePatterns(hgrBytes);
            const uniformity = calculateUniformity(hgrBytes);
            const distribution = getByteDistribution(hgrBytes, 5);

            console.log(`Orange: ${uniquePatterns} unique patterns, ${uniformity.toFixed(1)}% uniformity`);
            console.log('Top 5 bytes:', distribution);

            // ACCEPTANCE CRITERIA: Solid color should use ≤ 3 patterns, ≥ 80% uniform
            expect(uniquePatterns).toBeLessThanOrEqual(3);
            expect(uniformity).toBeGreaterThanOrEqual(80);
        });
    });

    describe('Blue (Hi-Bit 1 Palette)', () => {
        it('should produce solid output for pure blue', () => {
            const ditherer = new ImageDither();
            // Use actual NTSC-rendered color from byte 0xD5
            const blueColor = { r: 139, g: 139, b: 182 };
            const sourceImage = createSolidColorImage(280, 192, blueColor);

            const hgrBytes = ditherer.ditherToHgr(sourceImage, 40, 192, 'hybrid');

            const uniquePatterns = countUniquePatterns(hgrBytes);
            const uniformity = calculateUniformity(hgrBytes);
            const distribution = getByteDistribution(hgrBytes, 5);

            console.log(`Blue: ${uniquePatterns} unique patterns, ${uniformity.toFixed(1)}% uniformity`);
            console.log('Top 5 bytes:', distribution);

            expect(uniquePatterns).toBeLessThanOrEqual(3);
            expect(uniformity).toBeGreaterThanOrEqual(80);
        });
    });

    describe('Purple (Hi-Bit 0 Palette)', () => {
        it('should produce solid output for pure purple', () => {
            const ditherer = new ImageDither();
            // Use actual NTSC-rendered color from byte 0x55
            const purpleColor = { r: 162, g: 121, b: 177 };
            const sourceImage = createSolidColorImage(280, 192, purpleColor);

            const hgrBytes = ditherer.ditherToHgr(sourceImage, 40, 192, 'hybrid');

            const uniquePatterns = countUniquePatterns(hgrBytes);
            const uniformity = calculateUniformity(hgrBytes);
            const distribution = getByteDistribution(hgrBytes, 5);

            console.log(`Purple: ${uniquePatterns} unique patterns, ${uniformity.toFixed(1)}% uniformity`);
            console.log('Top 5 bytes:', distribution);

            expect(uniquePatterns).toBeLessThanOrEqual(3);
            expect(uniformity).toBeGreaterThanOrEqual(80);
        });
    });

    describe('Green (Hi-Bit 0 Palette)', () => {
        it('should produce solid output for pure green', () => {
            const ditherer = new ImageDither();
            // Use actual NTSC-rendered color from byte 0x2A
            const greenColor = { r: 93, g: 134, b: 78 };
            const sourceImage = createSolidColorImage(280, 192, greenColor);

            const hgrBytes = ditherer.ditherToHgr(sourceImage, 40, 192, 'hybrid');

            const uniquePatterns = countUniquePatterns(hgrBytes);
            const uniformity = calculateUniformity(hgrBytes);
            const distribution = getByteDistribution(hgrBytes, 5);

            console.log(`Green: ${uniquePatterns} unique patterns, ${uniformity.toFixed(1)}% uniformity`);
            console.log('Top 5 bytes:', distribution);

            expect(uniquePatterns).toBeLessThanOrEqual(3);
            expect(uniformity).toBeGreaterThanOrEqual(80);
        });
    });

    describe('Black (Grayscale)', () => {
        it('should produce solid output for black', () => {
            const ditherer = new ImageDither();
            const blackColor = { r: 0, g: 0, b: 0 };
            const sourceImage = createSolidColorImage(280, 192, blackColor);

            const hgrBytes = ditherer.ditherToHgr(sourceImage, 40, 192, 'hybrid');

            const uniquePatterns = countUniquePatterns(hgrBytes);
            const uniformity = calculateUniformity(hgrBytes);
            const distribution = getByteDistribution(hgrBytes, 5);

            console.log(`Black: ${uniquePatterns} unique patterns, ${uniformity.toFixed(1)}% uniformity`);
            console.log('Top 5 bytes:', distribution);

            // Black should be perfectly solid (0x00 or 0x80)
            expect(uniquePatterns).toBeLessThanOrEqual(1);
            expect(uniformity).toBeGreaterThanOrEqual(95);
        });
    });

    describe('White (Grayscale)', () => {
        it('should produce solid output for white', () => {
            const ditherer = new ImageDither();
            const whiteColor = { r: 255, g: 255, b: 255 };
            const sourceImage = createSolidColorImage(280, 192, whiteColor);

            const hgrBytes = ditherer.ditherToHgr(sourceImage, 40, 192, 'hybrid');

            const uniquePatterns = countUniquePatterns(hgrBytes);
            const uniformity = calculateUniformity(hgrBytes);
            const distribution = getByteDistribution(hgrBytes, 5);

            console.log(`White: ${uniquePatterns} unique patterns, ${uniformity.toFixed(1)}% uniformity`);
            console.log('Top 5 bytes:', distribution);

            // White should be perfectly solid (0x7F or 0xFF)
            expect(uniquePatterns).toBeLessThanOrEqual(1);
            expect(uniformity).toBeGreaterThanOrEqual(95);
        });
    });
});
