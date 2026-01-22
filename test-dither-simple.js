// Simple test to debug dithering algorithm

import ImageDither from './docs/src/lib/image-dither.js';

const dither = new ImageDither();

// Test 1: Calculate error for a simple gray pattern
const grayTargets = Array(7).fill({r: 128, g: 128, b: 128});

console.log('=== Test 1: Gray targets ===');
console.log('Target colors:', grayTargets);

// Test different byte patterns
const testBytes = [0x00, 0x7F, 0x55, 0x2A, 0x40, 0x20];
for (const byte of testBytes) {
    const error = dither.calculateNTSCError(0x00, byte, grayTargets, 0);
    console.log(`Byte 0x${byte.toString(16).padStart(2, '0')}: error = ${error.toFixed(2)}`);
}

// Test 2: Run findBestBytePattern
console.log('\n=== Test 2: Find best byte for gray ===');
const bestByte = dither.findBestBytePattern(0x00, grayTargets, 0);
console.log(`Best byte: 0x${bestByte.toString(16).padStart(2, '0')} (${bestByte.toString(2).padStart(8, '0')})`);
console.log(`Best byte error: ${dither.calculateNTSCError(0x00, bestByte, grayTargets, 0).toFixed(2)}`);

// Test 3: Render colors for the best byte
console.log('\n=== Test 3: Rendered colors ===');
const colors = dither.renderNTSCColors(0x00, bestByte, 0);
console.log('Rendered colors:');
colors.forEach((c, i) => {
    console.log(`  Pixel ${i}: RGB(${c.r}, ${c.g}, ${c.b})`);
});

// Test 4: Try white targets
const whiteTargets = Array(7).fill({r: 255, g: 255, b: 255});
console.log('\n=== Test 4: White targets ===');
const whiteByte = dither.findBestBytePattern(0x00, whiteTargets, 0);
console.log(`Best byte: 0x${whiteByte.toString(16).padStart(2, '0')} (${whiteByte.toString(2).padStart(8, '0')})`);
console.log(`Best byte error: ${dither.calculateNTSCError(0x00, whiteByte, whiteTargets, 0).toFixed(2)}`);
