import NTSCRenderer from './docs/src/lib/ntsc-renderer.js';

// Create a simple test: one scanline with alternating bytes
const renderer = new NTSCRenderer();
const rawBytes = new Uint8Array(8192); // Full HGR screen

// Fill first scanline with purple pattern (0x2A = 00101010)
for (let i = 0; i < 40; i++) {
    rawBytes[i] = 0x2A; // Alternating bits, hi-bit off = purple
}

// Create image data for one scanline
const imageData = {
    width: 560,
    height: 1,
    data: new Uint8Array(560 * 4)
};

console.log('Testing renderHgrScanline with purple pattern (0x2A)...');
renderer.renderHgrScanline(imageData, rawBytes, 0, 0);

// Sample first few pixels
console.log('\nFirst 10 pixels:');
for (let x = 0; x < 10; x++) {
    const idx = x * 4;
    const r = imageData.data[idx];
    const g = imageData.data[idx + 1];
    const b = imageData.data[idx + 2];
    console.log(`  Pixel ${x}: RGB=(${r}, ${g}, ${b})`);
}

// Check pattern extraction manually
console.log('\nManual pattern check:');
const b1 = 0x2A;
const b2 = 0x2A;
const word = NTSCRenderer.hgrToDhgr[b1][b2];
console.log(`hgrToDhgr[0x${b1.toString(16)}][0x${b2.toString(16)}] = 0x${word.toString(16)}`);

let bits = (word & 0x0fffffff) << 2;
console.log(`After << 2: 0x${bits.toString(16)}`);

for (let i = 0; i < 4; i++) {
    const phase = i % 4;
    const pattern = bits & 0x7f;
    const col = NTSCRenderer.solidPalette[phase][pattern];
    const r = (col >> 16) & 0xff;
    const g = (col >> 8) & 0xff;
    const b = col & 0xff;
    console.log(`  i=${i}, phase=${phase}, pattern=0x${pattern.toString(16)}, RGB=(${r}, ${g}, ${b})`);
    bits >>= 1;
}
