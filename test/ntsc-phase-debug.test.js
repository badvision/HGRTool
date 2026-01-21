import { describe, it } from 'vitest';
import NTSCRenderer from '../docs/src/lib/ntsc-renderer.js';

describe('NTSC Phase Debug - Trace Execution', () => {
  it('should trace phase calculation for green (0x55)', () => {
    const renderer = new NTSCRenderer();

    const rawBytes = new Uint8Array(8192);
    // Fill with green (0x55 = 1010101)
    for (let i = 0; i < 40; i++) {
      rawBytes[i] = 0x55;
    }

    const imageData = {
      data: new Uint8ClampedArray(560 * 4),
      width: 560,
    };

    // Manually trace what renderHgrScanline does
    console.log('\n=== TRACING GREEN (0x55 = 1010101) ===\n');

    // Step 1: Extract HGR bits
    const hgrBits = new Array(280);
    const hgrHighBits = new Array(280);
    let bitPos = 0;

    for (let byteIdx = 0; byteIdx < 40; byteIdx++) {
      const curByte = rawBytes[byteIdx];
      const highBit = (curByte & 0x80) !== 0;
      const dataBits = curByte & 0x7F;

      for (let bit = 0; bit < 7 && bitPos < 280; bit++) {
        hgrBits[bitPos] = (dataBits >> bit) & 1;
        hgrHighBits[bitPos] = highBit;
        bitPos++;
      }
    }

    console.log('First 14 HGR bits:', hgrBits.slice(0, 14).join(''));
    console.log('Expected for 0x55 (1010101): 1010101 1010101 (repeating)\n');

    // Step 2: Trace first few color calculations
    console.log('hgrX  bit0 bit1 bit2 bit3  highBit  dhgrX  phase  color');
    console.log('----  ---- ---- ---- ----  -------  -----  -----  -----');

    for (let hgrX = 0; hgrX < 14; hgrX += 2) {
      const bit0 = hgrX > 0 ? hgrBits[hgrX - 1] : 0;
      const bit1 = hgrBits[hgrX];
      const bit2 = hgrX + 1 < 280 ? hgrBits[hgrX + 1] : 0;
      const bit3 = hgrX + 2 < 280 ? hgrBits[hgrX + 2] : 0;
      const highBit = hgrHighBits[hgrX + 1 < 280 ? hgrX + 1 : hgrX];

      const pattern = (bit0 << 3) | (bit1 << 2) | (bit2 << 1) | bit3;
      const isAlternating = (pattern === 0b0101 || pattern === 0b1010);

      const dhgrX = hgrX * 2;
      const phase = (dhgrX + (highBit ? 1 : 0)) % 4;

      const phaseNames = ['purple', 'blue', 'green', 'orange'];
      const colorName = phaseNames[phase];

      console.log(
        `${hgrX.toString().padStart(4)}  ${bit0}    ${bit1}    ${bit2}    ${bit3}     ${highBit ? 1 : 0}        ${dhgrX.toString().padStart(5)}  ${phase}      ${colorName.padEnd(6)} ${isAlternating ? '(alternating)' : ''}`
      );
    }

    console.log('\n=== ACTUAL RENDERING ===\n');
    renderer.renderHgrScanline(imageData, rawBytes, 0, 0);

    // Sample first 14 DHGR pixels
    const data = imageData.data;
    console.log('DHGR  Phase  RGB');
    console.log('----  -----  ------');
    for (let x = 0; x < 14; x++) {
      const idx = x * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const rgb = ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
      const phase = x % 4;
      console.log(`${x.toString().padStart(4)}  ${phase}      ${rgb}`);
    }
  });

  it('should trace phase calculation for orange (0xd5)', () => {
    const renderer = new NTSCRenderer();

    const rawBytes = new Uint8Array(8192);
    // Fill with orange (0xd5 = 11010101 = 1010101 with high bit)
    for (let i = 0; i < 40; i++) {
      rawBytes[i] = 0xd5;
    }

    const imageData = {
      data: new Uint8ClampedArray(560 * 4),
      width: 560,
    };

    console.log('\n=== TRACING ORANGE (0xd5 = 1010101 + high bit) ===\n');

    // Extract HGR bits
    const hgrBits = new Array(280);
    const hgrHighBits = new Array(280);
    let bitPos = 0;

    for (let byteIdx = 0; byteIdx < 40; byteIdx++) {
      const curByte = rawBytes[byteIdx];
      const highBit = (curByte & 0x80) !== 0;
      const dataBits = curByte & 0x7F;

      for (let bit = 0; bit < 7 && bitPos < 280; bit++) {
        hgrBits[bitPos] = (dataBits >> bit) & 1;
        hgrHighBits[bitPos] = highBit;
        bitPos++;
      }
    }

    console.log('First 14 HGR bits:', hgrBits.slice(0, 14).join(''));
    console.log('High bit:', hgrHighBits[0] ? 'SET' : 'CLEAR');
    console.log('Expected for 0xd5 (1010101 + hi): 1010101 1010101 (repeating, high bit set)\n');

    console.log('hgrX  bit0 bit1 bit2 bit3  highBit  dhgrX  phase  color');
    console.log('----  ---- ---- ---- ----  -------  -----  -----  -----');

    for (let hgrX = 0; hgrX < 14; hgrX += 2) {
      const bit0 = hgrX > 0 ? hgrBits[hgrX - 1] : 0;
      const bit1 = hgrBits[hgrX];
      const bit2 = hgrX + 1 < 280 ? hgrBits[hgrX + 1] : 0;
      const bit3 = hgrX + 2 < 280 ? hgrBits[hgrX + 2] : 0;
      const highBit = hgrHighBits[hgrX + 1 < 280 ? hgrX + 1 : hgrX];

      const pattern = (bit0 << 3) | (bit1 << 2) | (bit2 << 1) | bit3;
      const isAlternating = (pattern === 0b0101 || pattern === 0b1010);

      const dhgrX = hgrX * 2;
      const phase = (dhgrX + (highBit ? 1 : 0)) % 4;

      const phaseNames = ['purple', 'blue', 'green', 'orange'];
      const colorName = phaseNames[phase];

      console.log(
        `${hgrX.toString().padStart(4)}  ${bit0}    ${bit1}    ${bit2}    ${bit3}     ${highBit ? 1 : 0}        ${dhgrX.toString().padStart(5)}  ${phase}      ${colorName.padEnd(6)} ${isAlternating ? '(alternating)' : ''}`
      );
    }

    console.log('\n=== ACTUAL RENDERING ===\n');
    renderer.renderHgrScanline(imageData, rawBytes, 0, 0);

    const data = imageData.data;
    console.log('DHGR  Phase  RGB');
    console.log('----  -----  ------');
    for (let x = 0; x < 14; x++) {
      const idx = x * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const rgb = ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
      const phase = x % 4;
      console.log(`${x.toString().padStart(4)}  ${phase}      ${rgb}`);
    }
  });
});
