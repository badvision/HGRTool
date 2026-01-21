/**
 * Debug YIQ calculations to understand why palettes are identical.
 */

import { describe, it, beforeAll } from 'vitest';

let NTSCRenderer;

beforeAll(async () => {
    const module = await import('../docs/src/lib/ntsc-renderer.js');
    NTSCRenderer = module.default;
});

describe('YIQ Calculation Debug', () => {
    it('should show YIQ calculations for test patterns', () => {
        console.log('\n=== YIQ Calculation Debug ===');

        const testPatterns = [
            0b00110011,  // Pattern with same color in both palettes
            0b00000111,  // Pattern with different colors
        ];

        const maxLevel = 10;

        for (const pattern of testPatterns) {
            console.log(`\n=== Pattern 0b${pattern.toString(2).padStart(8, '0')} (0x${pattern.toString(16).toUpperCase()}) ===`);

            // Calculate level
            const level = (pattern & 1) * 1 +
                          ((pattern >> 1) & 1) * 1 +
                          ((pattern >> 2) & 1) * 2 +
                          ((pattern >> 3) & 1) * 4 +
                          ((pattern >> 4) & 1) * 2 +
                          ((pattern >> 5) & 1) * 1;

            // Calculate color index
            const col = (pattern >> 2) & 15;

            console.log(`  Level: ${level}/${maxLevel} = ${(level / maxLevel).toFixed(2)}`);
            console.log(`  Color index: ${col} (bits 2-5: 0b${col.toString(2).padStart(4, '0')})`);

            // Look up YIQ values
            const yiq = NTSCRenderer.YIQ_COLORS[col];
            console.log(`  YIQ_COLORS[${col}]: [${yiq[0]}, ${yiq[1]}, ${yiq[2]}]`);

            const y1 = yiq[0];
            const y2 = level / maxLevel;
            const i = yiq[1] * NTSCRenderer.MAX_I;
            const q = yiq[2] * NTSCRenderer.MAX_Q;

            console.log(`  Solid Y (y1): ${y1.toFixed(3)}`);
            console.log(`  Text Y (y2):  ${y2.toFixed(3)}`);
            console.log(`  I: ${i.toFixed(3)} (${yiq[1]} * ${NTSCRenderer.MAX_I})`);
            console.log(`  Q: ${q.toFixed(3)} (${yiq[2]} * ${NTSCRenderer.MAX_Q})`);

            console.log(`\n  RGB conversion:`);
            console.log(`    Solid YIQ: (${y1.toFixed(3)}, ${i.toFixed(3)}, ${q.toFixed(3)})`);
            console.log(`    Text YIQ:  (${y2.toFixed(3)}, ${i.toFixed(3)}, ${q.toFixed(3)})`);

            // Calculate RGB values manually
            const solidRgb = calculateRgbFromYiq(y1, i, q);
            const textRgb = calculateRgbFromYiq(y2, i, q);

            console.log(`    Solid RGB: (${solidRgb.r}, ${solidRgb.g}, ${solidRgb.b})`);
            console.log(`    Text RGB:  (${textRgb.r}, ${textRgb.g}, ${textRgb.b})`);

            if (y1 === y2) {
                console.log(`  ⚠️  Y values are IDENTICAL - this is why colors match!`);
            } else {
                console.log(`  ✓ Y values differ by ${Math.abs(y1 - y2).toFixed(3)}`);
            }
        }
    });
});

function calculateRgbFromYiq(y, i, q) {
    const normalize = (x, minX, maxX) => Math.max(minX, Math.min(maxX, x));
    const r = Math.round(normalize(y + 0.956 * i + 0.621 * q, 0, 1) * 255);
    const g = Math.round(normalize(y - 0.272 * i - 0.647 * q, 0, 1) * 255);
    const b = Math.round(normalize(y - 1.105 * i + 1.702 * q, 0, 1) * 255);
    return { r, g, b };
}
