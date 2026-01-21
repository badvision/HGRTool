/**
 * Debug test to verify text palette is being generated correctly.
 */

import { describe, it, expect, beforeAll } from 'vitest';

// Import the NTSC renderer
let NTSCRenderer;

beforeAll(async () => {
    const module = await import('../docs/src/lib/ntsc-renderer.js');
    NTSCRenderer = module.default;
    console.log('NTSC Renderer loaded');
});

describe('Palette Generation Debug', () => {
    it('should generate different solid and text palettes', () => {
        console.log('\n=== Palette Debug ===');

        // Force palette initialization
        const renderer = new NTSCRenderer();

        // Check that both palettes exist
        expect(NTSCRenderer.solidPalette.length).toBe(4);
        expect(NTSCRenderer.textPalette.length).toBe(4);

        // Compare a few patterns
        const testPatterns = [
            0b00110011,  // 2-bit runs (level = 5)
            0b01111110,  // 6-bit run (level = 9)
            0b01010101,  // alternating (level = 3)
            0b00000111,  // 3-bit run (level = 6)
        ];

        console.log('\nPattern Analysis:');
        for (const pattern of testPatterns) {
            // Calculate level manually
            const level = (pattern & 1) * 1 +
                          ((pattern >> 1) & 1) * 1 +
                          ((pattern >> 2) & 1) * 2 +
                          ((pattern >> 3) & 1) * 4 +
                          ((pattern >> 4) & 1) * 2 +
                          ((pattern >> 5) & 1) * 1;

            console.log(`\nPattern 0b${pattern.toString(2).padStart(8, '0')} (0x${pattern.toString(16).toUpperCase()}):`);
            console.log(`  Level: ${level}/10`);

            // Check color at phase 0
            const solidColor = NTSCRenderer.solidPalette[0][pattern];
            const textColor = NTSCRenderer.textPalette[0][pattern];

            const solidR = (solidColor >> 16) & 0xff;
            const solidG = (solidColor >> 8) & 0xff;
            const solidB = solidColor & 0xff;

            const textR = (textColor >> 16) & 0xff;
            const textG = (textColor >> 8) & 0xff;
            const textB = textColor & 0xff;

            console.log(`  Solid palette: RGB(${solidR}, ${solidG}, ${solidB})`);
            console.log(`  Text palette:  RGB(${textR}, ${textG}, ${textB})`);

            if (solidColor === textColor) {
                console.log(`  ⚠️  SAME COLOR - Palettes are identical!`);
            } else {
                console.log(`  ✓ Different colors - palettes working`);
            }
        }
    });
});
