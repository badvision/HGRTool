import NTSCRenderer from './docs/src/lib/ntsc-renderer.js';

const renderer = new NTSCRenderer();

// Test pattern sequences from getSolidPatterns
// Pattern index 1 (purple): alternating 0x2A and 0x55
// Pattern index 2 (green): alternating 0x55 and 0x2A
// Pattern index 5 (blue): 0x80 (just hi-bit)
// Pattern index 6 (orange): alternating 0xAA and 0x55

const tests = [
  { name: 'Purple (1)', even: 0x2A, odd: 0x55 },
  { name: 'Green (2)', even: 0x55, odd: 0x2A },
  { name: 'Blue (5)', even: 0x80, odd: 0x80 },  // 0x80 XOR 0x7F = 0x7F, but 0x80 & 0x7F = 0, so odd = 0 | 0x80 = 0x80
  { name: 'Orange (6)', even: 0xAA, odd: 0x55 }
];

for (const test of tests) {
  const rawBytes = new Uint8Array(8192);

  // Fill with alternating pattern
  for (let i = 0; i < 40; i++) {
    rawBytes[i] = (i % 2 === 0) ? test.even : test.odd;
  }

  const imageData = {
    width: 560,
    height: 1,
    data: new Uint8Array(560 * 4)
  };

  renderer.renderHgrScanline(imageData, rawBytes, 0, 0);

  // Sample middle
  const idx = 280 * 4;
  const r = imageData.data[idx];
  const g = imageData.data[idx + 1];
  const b = imageData.data[idx + 2];

  console.log(`${test.name} [even=0x${test.even.toString(16)}, odd=0x${test.odd.toString(16)}]: RGB=(${r}, ${g}, ${b})`);
}
