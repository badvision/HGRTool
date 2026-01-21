import { describe, it, expect } from 'vitest';
import NTSCRenderer from '../docs/src/lib/ntsc-renderer.js';

describe('NTSC Debug - Detailed Rainbow Investigation', () => {
  it('should show exactly what colors are rendered for orange fill', () => {
    const renderer = new NTSCRenderer();

    // Create solid orange buffer (0xFF)
    const rawBytes = new Uint8Array(8192);
    for (let i = 0; i < 40; i++) {
      rawBytes[i] = 0xFF;
    }

    const imageData = {
      data: new Uint8ClampedArray(280 * 4),
      width: 280,
    };

    renderer.renderHgrScanline(imageData, rawBytes, 0, 0);

    // Show first 40 pixels in detail
    const data = imageData.data;
    const pixels = [];

    for (let x = 0; x < 40; x++) {
      const idx = x * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const rgb = (r << 16) | (g << 8) | b;
      const phase = x % 4;

      pixels.push({
        x,
        phase,
        rgb: rgb.toString(16).padStart(6, '0'),
        r,
        g,
        b
      });
    }

    console.log('\nFirst 40 pixels of solid 0xFF (orange) fill:');
    console.log('X    Phase  RGB       R   G   B');
    console.log('---  -----  ------  ---  ---  ---');
    for (const p of pixels) {
      console.log(`${p.x.toString().padStart(3)}  ${p.phase}      ${p.rgb}  ${p.r.toString().padStart(3)}  ${p.g.toString().padStart(3)}  ${p.b.toString().padStart(3)}`);
    }

    // Count unique colors
    const uniqueRgbs = new Set(pixels.map(p => p.rgb));
    console.log(`\nUnique colors: ${uniqueRgbs.size}`);
    console.log('Colors:', Array.from(uniqueRgbs));

    // Analyze pattern by phase
    const byPhase = { 0: [], 1: [], 2: [], 3: [] };
    for (const p of pixels) {
      byPhase[p.phase].push(p.rgb);
    }

    console.log('\nColors by phase:');
    for (let phase = 0; phase < 4; phase++) {
      const colors = new Set(byPhase[phase]);
      console.log(`Phase ${phase}: ${colors.size} unique colors - ${Array.from(colors).join(', ')}`);
    }
  });

  it('should trace through the rendering logic for first few pixels', () => {
    const renderer = new NTSCRenderer();

    // Manual simulation of what renderHgrScanline does
    const byte1 = 0xFF;
    const byte2 = 0xFF;

    console.log(`\nTracing rendering of byte1=0x${byte1.toString(16)}, byte2=0x${byte2.toString(16)}:`);

    const dhgrBits = NTSCRenderer.hgrToDhgr[byte1][byte2];
    console.log(`dhgrBits: 0x${dhgrBits.toString(16)} (binary: ${dhgrBits.toString(2).padStart(32, '0')})`);

    const palette = NTSCRenderer.solidPalette;

    console.log('\nPixel-by-pixel analysis (first 14 pixels = 7 bits * 2):');
    console.log('Bit  Phase  Pattern (7-bit)        Palette Color');
    console.log('---  -----  ---------------------  -------------');

    for (let bit = 0; bit < 7; bit++) {
      const phase = bit % 4;
      const pattern = (dhgrBits >> (bit * 2)) & 0x7f;
      const color = palette[phase][pattern];

      console.log(
        `${bit}    ${phase}      0x${pattern.toString(16).padStart(2, '0')} (${pattern.toString(2).padStart(7, '0')})  ` +
        `0x${color.toString(16).padStart(8, '0')}`
      );
    }
  });

  it('should compare pattern extraction methods', () => {
    // The current implementation uses: (dhgrBits >> (bit * 2)) & 0x7f
    // This creates a sliding window that shifts by 2 bits each time

    const byte1 = 0xFF;
    const byte2 = 0xFF;
    const dhgrBits = NTSCRenderer.hgrToDhgr[byte1][byte2];

    console.log('\n=== Current Implementation (Sliding Window) ===');
    console.log('Bit  Shift    Pattern (hex/bin)');
    for (let bit = 0; bit < 7; bit++) {
      const shift = bit * 2;
      const pattern = (dhgrBits >> shift) & 0x7f;
      console.log(`${bit}    ${shift.toString().padStart(2)}       0x${pattern.toString(16)} (${pattern.toString(2).padStart(7, '0')})`);
    }

    console.log('\n=== Alternative: Fixed Window per Byte ===');
    console.log('(Extract 7 bits once, use for all 7 pixels)');
    const fixedPattern = dhgrBits & 0x7f;
    console.log(`Pattern: 0x${fixedPattern.toString(16)} (${fixedPattern.toString(2).padStart(7, '0')})`);
    console.log('Would use same pattern for all 7 pixels, only varying by phase');
  });

  it('should analyze the DHGR bit expansion for 0xFF', () => {
    console.log('\n=== DHGR Bit Expansion Analysis ===');

    // Check what hgrToDhgr does with 0xFF
    const byte1 = 0xFF;
    const byte2 = 0xFF;

    console.log(`Input: byte1=0x${byte1.toString(16)} byte2=0x${byte2.toString(16)}`);

    // Manually trace through byteDoubler logic
    const b1Lower = byte1 & 0x7f; // 0x7f
    const b1High = (byte1 & 0x80) !== 0; // true

    console.log(`byte1: lower 7 bits = 0x${b1Lower.toString(16)}, high bit = ${b1High}`);

    const doubled = NTSCRenderer.byteDoubler(b1Lower);
    console.log(`byteDoubler(0x${b1Lower.toString(16)}) = 0x${doubled.toString(16)} (${doubled.toString(2).padStart(14, '0')})`);

    const dhgrBits = NTSCRenderer.hgrToDhgr[byte1][byte2];
    console.log(`hgrToDhgr result: 0x${dhgrBits.toString(16).padStart(8, '0')}`);
    console.log(`Binary (32-bit): ${dhgrBits.toString(2).padStart(32, '0')}`);

    // Show bits in groups of 7
    const binary = dhgrBits.toString(2).padStart(32, '0');
    console.log('\nBit positions (for sliding window extraction):');
    for (let bit = 0; bit < 7; bit++) {
      const shift = bit * 2;
      const pattern = (dhgrBits >> shift) & 0x7f;
      const binaryPattern = pattern.toString(2).padStart(7, '0');

      // Show which bits from dhgrBits are being used
      const bitPositions = [];
      for (let i = 0; i < 7; i++) {
        bitPositions.push(shift + i);
      }

      console.log(`Bit ${bit}: shift ${shift}, bits [${bitPositions.join(',')}] = ${binaryPattern} (0x${pattern.toString(16)})`);
    }
  });
});
