import { describe, it } from 'vitest';
import NTSCRenderer from '../docs/src/lib/ntsc-renderer.js';

/**
 * NTSC DHGR Conversion Debug Test
 *
 * This test traces through the DHGR bit expansion to understand why
 * solid orange (0xAA) renders as rainbow color bars instead of uniform orange.
 */

describe('NTSC DHGR Conversion Debug', () => {
  it('should trace DHGR bit expansion for orange pattern (0xAA)', () => {
    console.log('\n=== DHGR BIT EXPANSION DEBUG ===\n');

    // Orange pattern: alternating bytes 0xAA, 0xD5
    const orangeBytes = [0xAA, 0xD5, 0xAA, 0xD5, 0xAA];

    console.log('Input HGR bytes (orange):');
    console.log(orangeBytes.map(b => `0x${b.toString(16).padStart(2, '0')} (${b.toString(2).padStart(8, '0')})`).join('\n'));

    console.log('\n--- DHGR Lookup Table Results ---\n');

    // Simulate what renderHgrScanline does
    for (let byteIdx = 0; byteIdx < orangeBytes.length; byteIdx++) {
      const prevByte = byteIdx > 0 ? orangeBytes[byteIdx - 1] : 0;
      const curByte = orangeBytes[byteIdx];
      const prevHighBit = (prevByte & 0x80) ? 256 : 0;

      const dhgrValue = NTSCRenderer.hgrToDhgr[(prevByte & 0x7F) | prevHighBit][curByte];

      console.log(`Byte ${byteIdx}: 0x${curByte.toString(16).padStart(2, '0')} (prev: 0x${prevByte.toString(16).padStart(2, '0')})`);
      console.log(`  prevHighBit: ${prevHighBit}`);
      console.log(`  Lookup: hgrToDhgr[${(prevByte & 0x7F) | prevHighBit}][${curByte}]`);
      console.log(`  DHGR value: 0x${dhgrValue.toString(16).padStart(8, '0')}`);
      console.log(`  Binary (32-bit): ${dhgrValue.toString(2).padStart(32, '0')}`);

      // Extract the 14 bits that would be used (bits 14-27)
      const bits14to27 = (dhgrValue >> 14) & 0x3FFF;
      console.log(`  Bits 14-27 (used): ${bits14to27.toString(2).padStart(14, '0')}`);

      // Show the 14 bits as individual values
      const bitArray = [];
      for (let i = 0; i < 14; i++) {
        bitArray.push((dhgrValue >> (i + 14)) & 1);
      }
      console.log(`  Bit array: [${bitArray.join(', ')}]`);
      console.log('');
    }
  });

  it('should trace 4-bit window patterns for orange scanline', () => {
    console.log('\n=== 4-BIT WINDOW PATTERN ANALYSIS ===\n');

    const renderer = new NTSCRenderer();
    const rawBytes = new Uint8Array(8192);

    // Fill first row with orange pattern (0xAA, 0xD5, 0xAA, 0xD5...)
    for (let i = 0; i < 40; i++) {
      rawBytes[i] = (i % 2 === 0) ? 0xAA : 0xD5;
    }

    // Manually simulate DHGR conversion for first 4 bytes
    const dhgrBits = [];

    for (let byteIdx = 0; byteIdx < 4; byteIdx++) {
      const prevByte = byteIdx > 0 ? rawBytes[byteIdx - 1] : 0;
      const curByte = rawBytes[byteIdx];
      const prevHighBit = (prevByte & 0x80) ? 256 : 0;

      const dhgrValue = NTSCRenderer.hgrToDhgr[(prevByte & 0x7F) | prevHighBit][curByte];

      // Extract 14 bits
      for (let i = 0; i < 14; i++) {
        dhgrBits.push((dhgrValue >> (i + 14)) & 1);
      }
    }

    console.log(`DHGR bit stream (first 56 bits from 4 HGR bytes):`);
    console.log(dhgrBits.join(''));
    console.log('');

    // Now show 4-bit windows for first 28 DHGR pixels
    console.log('4-bit window patterns for first 28 DHGR pixels:');
    console.log('X    Phase  Window  Binary    Pattern Type');
    console.log('---  -----  ------  --------  ------------');

    const patternCounts = new Map();

    for (let x = 0; x < Math.min(28, dhgrBits.length); x++) {
      const bit0 = x < dhgrBits.length ? dhgrBits[x] : 0;
      const bit1 = x + 1 < dhgrBits.length ? dhgrBits[x + 1] : 0;
      const bit2 = x + 2 < dhgrBits.length ? dhgrBits[x + 2] : 0;
      const bit3 = x + 3 < dhgrBits.length ? dhgrBits[x + 3] : 0;

      const pattern = (bit0 << 3) | (bit1 << 2) | (bit2 << 1) | bit3;
      const phase = x % 4;

      let patternType;
      if (pattern === 0b0000) patternType = 'black';
      else if (pattern === 0b1111) patternType = 'white';
      else if (pattern === 0b0101) patternType = 'alternating-0101';
      else if (pattern === 0b1010) patternType = 'alternating-1010';
      else patternType = 'mixed';

      const patternKey = `${pattern.toString(2).padStart(4, '0')}-phase${phase}`;
      patternCounts.set(patternKey, (patternCounts.get(patternKey) || 0) + 1);

      console.log(`${x.toString().padStart(3)}  ${phase}      0x${pattern.toString(16)}    ${pattern.toString(2).padStart(4, '0')}      ${patternType}`);
    }

    console.log('\nPattern occurrence counts:');
    const sortedPatterns = Array.from(patternCounts.entries()).sort((a, b) => b[1] - a[1]);
    for (const [pattern, count] of sortedPatterns) {
      console.log(`  ${pattern}: ${count} times`);
    }

    console.log('\n🔍 Analysis:');
    console.log(`  Unique pattern+phase combinations: ${patternCounts.size}`);
    if (patternCounts.size > 4) {
      console.log('  ⚠️  Too many unique combinations for solid color!');
      console.log('  This explains the rainbow color bar effect.');
    }
  });

  it('should test actual color output for each pattern+phase combination', () => {
    console.log('\n=== COLOR OUTPUT PER PATTERN+PHASE ===\n');

    const renderer = new NTSCRenderer();

    // Test all possible 4-bit patterns with all 4 phases
    const patterns = [0b0000, 0b0101, 0b1010, 0b1111];
    const phases = [0, 1, 2, 3];

    console.log('Pattern  Phase  Y      I       Q       RGB');
    console.log('-------  -----  -----  ------  ------  ------');

    const uniqueColors = new Set();

    for (const pattern of patterns) {
      for (const phase of phases) {
        const [y, i, q] = renderer.getColorFromPattern(pattern, phase);
        const rgb = NTSCRenderer.yiqToRgb(y, i, q);
        const hexColor = rgb.toString(16).padStart(6, '0');

        uniqueColors.add(hexColor);

        console.log(
          `${pattern.toString(2).padStart(4, '0')}     ${phase}      ${y.toFixed(2)}   ${i.toFixed(2)}    ${q.toFixed(2)}    #${hexColor}`
        );
      }
    }

    console.log(`\nUnique colors produced: ${uniqueColors.size}`);
    console.log('Colors:', Array.from(uniqueColors).map(c => `#${c}`).join(', '));
  });

  it('should compare expected vs actual DHGR bits for solid orange', () => {
    console.log('\n=== EXPECTED VS ACTUAL DHGR BITS ===\n');

    const renderer = new NTSCRenderer();

    // For orange 0xAA (10101010), we expect:
    // - Each bit doubled: 1100110011001100
    // - Repeated across scanline

    console.log('Expected DHGR pattern for 0xAA (simple bit doubling):');
    console.log('HGR:  1 0 1 0 1 0 1 0');
    console.log('DHGR: 11001100110011001100110011001100');

    console.log('\nActual DHGR from hgrToDhgr lookup:');

    // Check what hgrToDhgr produces for consecutive 0xAA bytes
    const byte1 = 0xAA;
    const byte2 = 0xAA;
    const prevHighBit = (byte1 & 0x80) ? 256 : 0;

    const dhgrValue = NTSCRenderer.hgrToDhgr[(byte1 & 0x7F) | prevHighBit][byte2];

    console.log(`hgrToDhgr[${(byte1 & 0x7F) | prevHighBit}][${byte2}] = 0x${dhgrValue.toString(16).padStart(8, '0')}`);
    console.log(`Binary: ${dhgrValue.toString(2).padStart(32, '0')}`);

    // Extract bits 14-27 (the 14 bits used for rendering)
    const usedBits = [];
    for (let i = 0; i < 14; i++) {
      usedBits.push((dhgrValue >> (i + 14)) & 1);
    }
    console.log(`Used bits (14-27): ${usedBits.join('')}`);

    console.log('\n🔍 Comparison:');
    const expected = '11001100110011';
    const actual = usedBits.join('');

    if (expected === actual) {
      console.log('  ✅ Matches expected pattern (simple bit doubling)');
    } else {
      console.log('  ❌ Does NOT match expected pattern');
      console.log(`  Expected: ${expected}`);
      console.log(`  Actual:   ${actual}`);
      console.log('  The hgrToDhgr table is applying interpolation/smoothing');
    }
  });
});
