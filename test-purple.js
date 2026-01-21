import NTSCRenderer from './docs/src/lib/ntsc-renderer.js';

// Create renderer
const renderer = new NTSCRenderer();
const rawBytes = new Uint8Array(8192);

// Try different patterns for purple
const patterns = [
    { val: 0xAA, name: '0xAA (10101010, hi-bit on)' },
    { val: 0x2A, name: '0x2A (00101010, hi-bit off)' },
    { val: 0x55, name: '0x55 (01010101, hi-bit off)' },
    { val: 0xD5, name: '0xD5 (11010101, hi-bit on)' }
];

for (const test of patterns) {
    // Fill scanline
    for (let i = 0; i < 40; i++) {
        rawBytes[i] = test.val;
    }

    // Render
    const imageData = {
        width: 560,
        height: 1,
        data: new Uint8Array(560 * 4)
    };

    renderer.renderHgrScanline(imageData, rawBytes, 0, 0);

    // Sample middle pixels
    const idx = 100 * 4;
    const r = imageData.data[idx];
    const g = imageData.data[idx + 1];
    const b = imageData.data[idx + 2];

    console.log(`${test.name}: RGB=(${r}, ${g}, ${b})`);
}
