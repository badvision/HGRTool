#!/usr/bin/env node

import fs from 'fs';
import { renderToCanvas } from './hgr-ntsc.js';

// Create test pattern: alternating high-bit rows
// Even rows: high bit OFF (0x2A = 0b00101010)
// Odd rows:  high bit ON  (0xAA = 0b10101010)
const alternatingHighBit = new Uint8Array(8000);
for (let row = 0; row < 192; row++) {
  for (let col = 0; col < 40; col++) {
    const offset = row * 40 + col;
    // Even rows: 0x2A (high bit OFF), Odd rows: 0xAA (high bit ON)
    alternatingHighBit[offset] = (row % 2 === 0) ? 0x2A : 0xAA;
  }
}

// Save as binary file for OutlawEditor reference
fs.writeFileSync('/tmp/claude/hgrtool-ntsc-rendering/iteration-2/alternating-highbit.bin', alternatingHighBit);

// Render with HGRTool
const canvas = renderToCanvas(alternatingHighBit);
const buffer = canvas.toBuffer('image/png');
fs.writeFileSync('/tmp/claude/hgrtool-ntsc-rendering/iteration-2/alternating-highbit-hgrtool.png', buffer);

console.log('Created test pattern: alternating-highbit.bin');
console.log('Even rows: 0x2A (0b00101010) - high bit OFF');
console.log('Odd rows:  0xAA (0b10101010) - high bit ON');
console.log('Rendered HGRTool output: alternating-highbit-hgrtool.png');
console.log('Next: Generate OutlawEditor reference for comparison');
