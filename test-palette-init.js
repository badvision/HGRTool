import NTSCRenderer from './docs/src/lib/ntsc-renderer.js';

// Create renderer instance to trigger init
const renderer = new NTSCRenderer();

console.log('Palettes initialized:');
console.log('solidPalette dimensions:', NTSCRenderer.solidPalette.length, 'x', NTSCRenderer.solidPalette[0] ? NTSCRenderer.solidPalette[0].length : 'undefined');
console.log('textPalette dimensions:', NTSCRenderer.textPalette.length, 'x', NTSCRenderer.textPalette[0] ? NTSCRenderer.textPalette[0].length : 'undefined');

// Check some palette values
console.log('\nSample solidPalette values:');
for (let phase = 0; phase < 4; phase++) {
    const pattern = 0x7f; // All bits set
    const color = NTSCRenderer.solidPalette[phase][pattern];
    const r = (color >> 16) & 0xff;
    const g = (color >> 8) & 0xff;
    const b = color & 0xff;
    console.log(`  phase ${phase}, pattern 0x7f: RGB=(${r}, ${g}, ${b})`);
}

console.log('\nhgrToDhgr initialized:', NTSCRenderer.hgrToDhgr.length > 0);
console.log('hgrToDhgrBW initialized:', NTSCRenderer.hgrToDhgrBW.length > 0);

// Test a simple conversion
const testByte1 = 0x2A; // 00101010 - alternating pattern, hi-bit off
const testByte2 = 0xAA; // 10101010 - alternating pattern, hi-bit on
console.log(`\nTest hgrToDhgr[0][0x${testByte1.toString(16)}] = 0x${NTSCRenderer.hgrToDhgr[0][testByte1].toString(16)}`);
console.log(`Test hgrToDhgr[0][0x${testByte2.toString(16)}] = 0x${NTSCRenderer.hgrToDhgr[0][testByte2].toString(16)}`);
