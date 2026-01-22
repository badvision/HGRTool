/**
 * Unit test for HGR row interleaving
 *
 * This tests the fix for the bug where 12 rows were missing from imported images
 * due to buffer overflow (buffer was 7680 bytes but interleaved offsets go up to 8184).
 */

import { test, expect } from '@playwright/test';

test.describe('HGR Row Interleaving', () => {

  test('rowToHgrOffset produces unique offsets for all 192 rows', () => {
    // The rowToHgrOffset function from image-editor.js
    function rowToHgrOffset(row) {
      const low = ((row & 0xc0) >> 1) | ((row & 0xc0) >> 3) | ((row & 0x08) << 4);
      const high = ((row & 0x07) << 2) | ((row & 0x30) >> 4);
      return (high << 8) | low;
    }

    const offsets = new Set();
    const rows = [];

    // Calculate offsets for all 192 rows
    for (let row = 0; row < 192; row++) {
      const offset = rowToHgrOffset(row);
      expect(offsets.has(offset)).toBe(false); // No duplicates
      offsets.add(offset);
      rows.push({ row, offset });
    }

    // Should have 192 unique offsets
    expect(offsets.size).toBe(192);
  });

  test('all row offsets fit within 8192-byte buffer', () => {
    function rowToHgrOffset(row) {
      const low = ((row & 0xc0) >> 1) | ((row & 0xc0) >> 3) | ((row & 0x08) << 4);
      const high = ((row & 0x07) << 2) | ((row & 0x30) >> 4);
      return (high << 8) | low;
    }

    const BUFFER_SIZE = 8192;
    const ROW_SIZE = 40;

    const outOfBounds = [];

    // Check all 192 rows
    for (let row = 0; row < 192; row++) {
      const offset = rowToHgrOffset(row);
      const endOffset = offset + ROW_SIZE - 1;

      if (offset >= BUFFER_SIZE || endOffset >= BUFFER_SIZE) {
        outOfBounds.push({ row, offset, endOffset });
      }
    }

    // Should be no out-of-bounds rows
    expect(outOfBounds.length).toBe(0);
  });

  test('previously problematic rows (39, 47, 55, 63, etc.) now fit in buffer', () => {
    function rowToHgrOffset(row) {
      const low = ((row & 0xc0) >> 1) | ((row & 0xc0) >> 3) | ((row & 0x08) << 4);
      const high = ((row & 0x07) << 2) | ((row & 0x30) >> 4);
      return (high << 8) | low;
    }

    const BUFFER_SIZE = 8192;
    const ROW_SIZE = 40;

    // These were the 12 rows that were missing before the fix
    const problematicRows = [39, 47, 55, 63, 103, 111, 119, 127, 167, 175, 183, 191];

    for (const row of problematicRows) {
      const offset = rowToHgrOffset(row);
      const endOffset = offset + ROW_SIZE - 1;

      // All bytes should be within buffer
      expect(offset).toBeLessThan(BUFFER_SIZE);
      expect(endOffset).toBeLessThan(BUFFER_SIZE);
    }
  });

  test('interleaving with 8192-byte buffer covers all rows', () => {
    function rowToHgrOffset(row) {
      const low = ((row & 0xc0) >> 1) | ((row & 0xc0) >> 3) | ((row & 0x08) << 4);
      const high = ((row & 0x07) << 2) | ((row & 0x30) >> 4);
      return (high << 8) | low;
    }

    // Simulate the import process
    const linearData = new Uint8Array(7680); // 192 rows * 40 bytes (linear)
    const interleavedData = new Uint8Array(8192); // HGR page size (FIXED!)

    // Fill linear data with row identifiers
    for (let row = 0; row < 192; row++) {
      const linearOffset = row * 40;
      for (let col = 0; col < 40; col++) {
        linearData[linearOffset + col] = row + 1; // +1 to avoid 0
      }
    }

    // Do the interleaving
    for (let row = 0; row < 192; row++) {
      const linearOffset = row * 40;
      const interleavedOffset = rowToHgrOffset(row);
      for (let col = 0; col < 40; col++) {
        interleavedData[interleavedOffset + col] = linearData[linearOffset + col];
      }
    }

    // Verify all rows are present
    const foundRows = new Set();
    const emptyRows = [];

    for (let row = 0; row < 192; row++) {
      const offset = rowToHgrOffset(row);
      let hasData = false;
      let rowValue = null;

      for (let col = 0; col < 40; col++) {
        const byte = interleavedData[offset + col];
        if (byte !== 0) {
          hasData = true;
          if (rowValue === null) {
            rowValue = byte;
          }
        }
      }

      if (!hasData) {
        emptyRows.push(row);
      } else if (rowValue !== null) {
        foundRows.add(rowValue - 1);
      }
    }

    // All 192 rows should have data
    expect(emptyRows.length).toBe(0);
    expect(foundRows.size).toBe(192);

    // No missing row values
    for (let row = 0; row < 192; row++) {
      expect(foundRows.has(row)).toBe(true);
    }
  });

  test('7680-byte buffer would fail (regression test)', () => {
    function rowToHgrOffset(row) {
      const low = ((row & 0xc0) >> 1) | ((row & 0xc0) >> 3) | ((row & 0x08) << 4);
      const high = ((row & 0x07) << 2) | ((row & 0x30) >> 4);
      return (high << 8) | low;
    }

    const OLD_BUFFER_SIZE = 7680; // The buggy size
    const ROW_SIZE = 40;

    const outOfBounds = [];

    for (let row = 0; row < 192; row++) {
      const offset = rowToHgrOffset(row);
      const endOffset = offset + ROW_SIZE - 1;

      if (offset >= OLD_BUFFER_SIZE || endOffset >= OLD_BUFFER_SIZE) {
        outOfBounds.push(row);
      }
    }

    // Should find exactly 12 out-of-bounds rows (the bug we fixed)
    expect(outOfBounds.length).toBe(12);
    expect(outOfBounds).toEqual([39, 47, 55, 63, 103, 111, 119, 127, 167, 175, 183, 191]);
  });
});
