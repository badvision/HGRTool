/*
 * Debug test to see what's happening with first byte selection
 */

import { describe, it, beforeAll } from 'vitest';

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

describe('First Byte Palette Selection Debug', () => {
    it('should show what happens for orange', () => {
        const ditherer = new ImageDither();
        const orangeColor = { r: 255, g: 127, b: 0 };

        console.log('\\n=== ORANGE TEST ===');
        console.log('Target color:', orangeColor);

        // Get first 7 pixels worth of target
        const pixels = new Uint8ClampedArray(280 * 192 * 4);
        for (let i = 0; i < pixels.length; i += 4) {
            pixels[i] = orangeColor.r;
            pixels[i + 1] = orangeColor.g;
            pixels[i + 2] = orangeColor.b;
            pixels[i + 3] = 255;
        }

        const errorBuffer = new Array(192);
        for (let y = 0; y < 192; y++) {
            errorBuffer[y] = new Array(280);
            for (let x = 0; x < 280; x++) {
                errorBuffer[y][x] = [0, 0, 0];
            }
        }

        const target = ditherer.getTargetWithError(pixels, errorBuffer, 0, 0, 280);
        console.log('Target colors for first 7 pixels:', target);

        // Test best byte from hi-bit 0 context
        const byte0 = ditherer.findBestBytePattern(0x00, target, 0);
        const error0 = ditherer.calculateNTSCError(0x00, byte0, target, 0);
        const rendered0 = ditherer.renderNTSCColors(0x00, byte0, 0);

        console.log('\\nHi-bit 0 context (prevByte=0x00):');
        console.log(`  Best byte: 0x${byte0.toString(16).toUpperCase()}`);
        console.log(`  Hi-bit: ${(byte0 & 0x80) ? 1 : 0}`);
        console.log(`  Error: ${error0.toFixed(2)}`);
        console.log('  Rendered colors:', rendered0);

        // Test best byte from hi-bit 1 context
        const byte1 = ditherer.findBestBytePattern(0x80, target, 0);
        const error1 = ditherer.calculateNTSCError(0x00, byte1, target, 0);
        const rendered1 = ditherer.renderNTSCColors(0x00, byte1, 0);

        console.log('\\nHi-bit 1 context (prevByte=0x80):');
        console.log(`  Best byte: 0x${byte1.toString(16).toUpperCase()}`);
        console.log(`  Hi-bit: ${(byte1 & 0x80) ? 1 : 0}`);
        console.log(`  Error: ${error1.toFixed(2)}`);
        console.log('  Rendered colors:', rendered1);

        console.log(`\\nWinner: ${error0 <= error1 ? 'Hi-bit 0' : 'Hi-bit 1'} (error ${Math.min(error0, error1).toFixed(2)})`);
    });
});
