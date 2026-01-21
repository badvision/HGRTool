import { describe, it } from 'vitest';
import StdHiRes from '../docs/src/lib/std-hi-res.js';

/**
 * Monochrome Split Image Debug Test
 *
 * This test investigates why monochrome rendering shows a split image
 * with even rows on the left and odd rows on the right.
 */

describe('Monochrome Split Image Debug', () => {
  it('should analyze pixel positions in monochrome rendering', () => {
    console.log('\n=== MONOCHROME SPLIT IMAGE DEBUG ===\n');

    const hires = new StdHiRes();
    hires.renderMode = 'mono';

    // Draw a simple test pattern:
    // Row 50: fill columns 100-120 with white
    // Row 51: fill columns 100-120 with white
    // Row 52: fill columns 100-120 with white

    const whitePattern = StdHiRes.createSimplePattern(0x7F);  // All bits set = white

    // Fill 3 rows
    for (let y = 50; y < 53; y++) {
      for (let x = 100; x < 120; x += 7) {
        hires.plotHorizSegment(x, y, Math.min(7, 120 - x), whitePattern);
      }
    }

    // Render to ImageData
    const imageData = new ImageData(280, 192);
    hires.renderFull(imageData, true);

    // Analyze where white pixels appear
    console.log('Scanning for white pixels...\n');

    const whitePixels = [];
    for (let y = 0; y < 192; y++) {
      for (let x = 0; x < 280; x++) {
        const idx = (y * 280 + x) * 4;
        const r = imageData.data[idx];
        const g = imageData.data[idx + 1];
        const b = imageData.data[idx + 2];

        if (r > 200 && g > 200 && b > 200) {  // White-ish
          whitePixels.push({ x, y });
        }
      }
    }

    console.log(`Total white pixels found: ${whitePixels.length}\n`);

    if (whitePixels.length === 0) {
      console.log('⚠️  NO WHITE PIXELS FOUND!');
      console.log('This indicates monochrome rendering is completely broken.');
      return;
    }

    // Group by row
    const rowGroups = new Map();
    for (const { x, y } of whitePixels) {
      if (!rowGroups.has(y)) {
        rowGroups.set(y, []);
      }
      rowGroups.get(y).push(x);
    }

    console.log('White pixels by row:');
    const sortedRows = Array.from(rowGroups.keys()).sort((a, b) => a - b);
    for (const y of sortedRows.slice(0, 10)) {  // Show first 10 rows
      const xs = rowGroups.get(y).sort((a, b) => a - b);
      const xRange = `${xs[0]}-${xs[xs.length - 1]}`;
      console.log(`  Row ${y.toString().padStart(3)}: ${xs.length.toString().padStart(3)} pixels at columns ${xRange}`);
    }

    // Check for split pattern
    console.log('\nChecking for split image pattern...\n');

    // Check if even rows and odd rows have different X positions
    const evenRowXs = new Set();
    const oddRowXs = new Set();

    for (const y of sortedRows) {
      const xs = rowGroups.get(y);
      if (y % 2 === 0) {
        xs.forEach(x => evenRowXs.add(x));
      } else {
        xs.forEach(x => oddRowXs.add(x));
      }
    }

    console.log(`Even rows: pixels at ${evenRowXs.size} unique X positions`);
    console.log(`Odd rows:  pixels at ${oddRowXs.size} unique X positions`);

    // Check for separation
    const evenXArray = Array.from(evenRowXs).sort((a, b) => a - b);
    const oddXArray = Array.from(oddRowXs).sort((a, b) => a - b);

    if (evenXArray.length > 0 && oddXArray.length > 0) {
      const evenMax = Math.max(...evenXArray);
      const oddMin = Math.min(...oddXArray);

      console.log(`Even rows max X: ${evenMax}`);
      console.log(`Odd rows min X:  ${oddMin}`);

      if (oddMin > evenMax + 10) {
        console.log('\n🚨 SPLIT IMAGE CONFIRMED!');
        console.log('   Even rows are on the LEFT');
        console.log('   Odd rows are on the RIGHT');
        console.log('   They are separated by a gap');
      }

      // Check if odd rows are at half-width positions
      const expectedX = 100;  // Where we drew the pattern
      const avgEvenX = evenXArray.reduce((a, b) => a + b, 0) / evenXArray.length;
      const avgOddX = oddXArray.reduce((a, b) => a + b, 0) / oddXArray.length;

      console.log(`\nExpected X position: ${expectedX}`);
      console.log(`Actual even row avg X: ${Math.round(avgEvenX)}`);
      console.log(`Actual odd row avg X: ${Math.round(avgOddX)}`);

      // Check if they're at half-width intervals
      if (Math.abs(avgEvenX - expectedX / 2) < 10) {
        console.log('\n⚠️  Even rows appear at HALF the expected X position!');
        console.log('   This suggests ImageData width mismatch or stride error.');
      }

      if (Math.abs(avgOddX - (140 + expectedX / 2)) < 10) {
        console.log('⚠️  Odd rows appear at offset 140 + half expected X!');
        console.log('   This confirms split image with 140px offset.');
      }
    }
  });

  it('should trace monochrome rendering function calls', () => {
    console.log('\n=== MONOCHROME RENDERING TRACE ===\n');

    const hires = new StdHiRes();
    hires.renderMode = 'mono';

    // Draw single pixel at known position
    const whitePattern = StdHiRes.createSimplePattern(0x7F);
    hires.setPixel(100, 50, whitePattern);  // Column 100, Row 50

    // Manually call renderLineAsMono to trace what happens
    const imageData = new ImageData(280, 192);

    console.log('Rendering row 50, columns 98-105 (includes pixel at 100)');
    console.log('ImageData dimensions:', imageData.width, 'x', imageData.height);
    console.log('');

    // Check what's in HGR memory
    const rowOffset = StdHiRes.rowToOffset(50);
    const byteCol = Math.trunc(100 / 7);  // byte 14
    const bitPos = 100 % 7;  // bit 2

    console.log(`HGR memory:`);
    console.log(`  Row offset: ${rowOffset}`);
    console.log(`  Byte column: ${byteCol}`);
    console.log(`  Bit position: ${bitPos}`);
    console.log(`  Byte value: 0x${hires.rawData[rowOffset + byteCol].toString(16).padStart(2, '0')}`);

    // Render the line
    hires.renderLineAsMono(imageData.data, 50, 98, 8, undefined);

    // Check what got rendered
    console.log('\nImageData after rendering:');
    for (let x = 98; x < 106; x++) {
      const idx = (50 * 280 + x) * 4;
      const r = imageData.data[idx];
      const g = imageData.data[idx + 1];
      const b = imageData.data[idx + 2];
      const rgb = (r > 200) ? 'WHITE' : 'BLACK';
      console.log(`  X=${x}: R=${r} G=${g} B=${b} (${rgb})`);
    }
  });

  it('should compare monochrome vs RGB rendering of same data', () => {
    console.log('\n=== MONOCHROME VS RGB COMPARISON ===\n');

    // Create two instances with same data
    const hiresRgb = new StdHiRes();
    hiresRgb.renderMode = 'rgb';

    const hiresMono = new StdHiRes();
    hiresMono.renderMode = 'mono';

    // Draw white rectangle in both
    const whitePattern = StdHiRes.createSimplePattern(0x7F);
    for (let y = 50; y < 60; y++) {
      hiresRgb.plotHorizSegment(100, y, 20, whitePattern);
      hiresMono.plotHorizSegment(100, y, 20, whitePattern);
    }

    // Render both
    const imageDataRgb = new ImageData(280, 192);
    const imageDataMono = new ImageData(280, 192);

    hiresRgb.renderFull(imageDataRgb, false);
    hiresMono.renderFull(imageDataMono, true);

    // Count non-black pixels
    const countNonBlack = (data) => {
      let count = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] > 0 || data[i + 1] > 0 || data[i + 2] > 0) {
          count++;
        }
      }
      return count;
    };

    const rgbCount = countNonBlack(imageDataRgb.data);
    const monoCount = countNonBlack(imageDataMono.data);

    console.log(`RGB non-black pixels:  ${rgbCount}`);
    console.log(`Mono non-black pixels: ${monoCount}`);
    console.log(`Expected: ~200 pixels (20 columns × 10 rows)`);

    if (monoCount < rgbCount / 2) {
      console.log('\n🚨 MONOCHROME HAS LESS THAN HALF THE PIXELS OF RGB!');
      console.log('   This confirms the split image bug is compressing the image.');
    }

    // Check pixel positions
    console.log('\nPixel position analysis:');

    const rgbPositions = [];
    const monoPositions = [];

    for (let y = 50; y < 60; y++) {
      for (let x = 0; x < 280; x++) {
        const idx = (y * 280 + x) * 4;

        if (imageDataRgb.data[idx] > 0) {
          rgbPositions.push({ x, y });
        }

        if (imageDataMono.data[idx] > 0) {
          monoPositions.push({ x, y });
        }
      }
    }

    console.log(`RGB: Found ${rgbPositions.length} pixels`);
    if (rgbPositions.length > 0) {
      const xs = rgbPositions.map(p => p.x);
      console.log(`  X range: ${Math.min(...xs)} - ${Math.max(...xs)}`);
    }

    console.log(`Mono: Found ${monoPositions.length} pixels`);
    if (monoPositions.length > 0) {
      const xs = monoPositions.map(p => p.x);
      console.log(`  X range: ${Math.min(...xs)} - ${Math.max(...xs)}`);

      // Check if mono pixels are split
      const leftHalf = monoPositions.filter(p => p.x < 140).length;
      const rightHalf = monoPositions.filter(p => p.x >= 140).length;

      console.log(`  Left half (X<140): ${leftHalf} pixels`);
      console.log(`  Right half (X>=140): ${rightHalf} pixels`);

      if (leftHalf > 0 && rightHalf > 0) {
        console.log('\n  🚨 Mono pixels are SPLIT between left and right halves!');
      }
    }
  });
});
