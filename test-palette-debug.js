// Quick debug script to test NTSC palette initialization
import NTSCRenderer from './docs/src/lib/ntsc-renderer.js';

console.log('=== NTSC Palette Debug ===\n');

// Create renderer instance (should trigger palette init)
const renderer = new NTSCRenderer();

console.log('Palette structure check:');
console.log(`- solidPalette is array: ${Array.isArray(NTSCRenderer.solidPalette)}`);
console.log(`- solidPalette length: ${NTSCRenderer.solidPalette.length}`);
console.log(`- solidPalette[0] is array: ${Array.isArray(NTSCRenderer.solidPalette[0])}`);
console.log(`- solidPalette[0] length: ${NTSCRenderer.solidPalette[0]?.length}`);

console.log('\nSample palette values:');
for (let phase = 0; phase < 4; phase++) {
    for (let pattern of [0, 1, 64, 69, 76, 102, 127]) {
        const argb = NTSCRenderer.solidPalette[phase][pattern];
        const r = (argb >> 16) & 0xff;
        const g = (argb >> 8) & 0xff;
        const b = argb & 0xff;
        console.log(`  [${phase}][${pattern}] = 0x${argb.toString(16).padStart(8, '0')} → RGB(${r}, ${g}, ${b})`);
    }
}

console.log('\nActive palette check:');
console.log(`- activePalette === solidPalette: ${NTSCRenderer.activePalette === NTSCRenderer.solidPalette}`);
console.log(`- activePalette[0][76] = 0x${NTSCRenderer.activePalette[0][76]?.toString(16)}`);
