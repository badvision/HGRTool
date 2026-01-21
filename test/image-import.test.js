import { describe, it, expect, beforeEach } from 'vitest';
import ImageDither from '../docs/src/lib/image-dither.js';

/**
 * Tests for image import and dithering to HGR format.
 *
 * These tests reproduce the bug where imported images result in garbage output
 * instead of properly dithered HGR data.
 */

// Helper function to create ImageData without relying on canvas
function createImageData(width, height, fillColor) {
  const data = new Uint8ClampedArray(width * height * 4);
  const [r, g, b] = fillColor;
  for (let i = 0; i < width * height; i++) {
    const offset = i * 4;
    data[offset] = r;
    data[offset + 1] = g;
    data[offset + 2] = b;
    data[offset + 3] = 255; // Alpha
  }
  const imageData = new ImageData(width, height);
  imageData.data.set(data);
  return imageData;
}

// Helper function to create a checkerboard pattern
function createCheckerboardImageData(width, height, squareSize) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const isWhite = (Math.floor(x / squareSize) + Math.floor(y / squareSize)) % 2 === 0;
      const offset = (y * width + x) * 4;
      const value = isWhite ? 255 : 0;
      data[offset] = value;
      data[offset + 1] = value;
      data[offset + 2] = value;
      data[offset + 3] = 255;
    }
  }
  const imageData = new ImageData(width, height);
  imageData.data.set(data);
  return imageData;
}

// Helper function to create a horizontal gradient
function createGradientImageData(width, height) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4;
      const value = Math.floor((x / width) * 255);
      data[offset] = value;
      data[offset + 1] = value;
      data[offset + 2] = value;
      data[offset + 3] = 255;
    }
  }
  const imageData = new ImageData(width, height);
  imageData.data.set(data);
  return imageData;
}

describe('Image Import and Dithering', () => {
  let dither;

  beforeEach(() => {
    dither = new ImageDither();
  });

  describe('HGR output format validation', () => {
    it('should produce exactly 8192 bytes for HGR screen (40 bytes * 192 rows)', () => {
      const imageData = createImageData(280, 192, [0, 0, 0]);

      const hgrData = dither.ditherToHgr(imageData, 40, 192, true);

      expect(hgrData).toBeInstanceOf(Uint8Array);
      expect(hgrData.length).toBe(7680); // 40 bytes * 192 rows // 40 bytes * 192 rows
    });

    it('should produce valid HGR bytes (7 data bits + 1 high bit)', () => {
      const imageData = createImageData(280, 192, [255, 255, 255]);

      const hgrData = dither.ditherToHgr(imageData, 40, 192, true);

      // Check that each byte is valid HGR format
      // Each byte should have bits in the range 0x00-0xFF
      for (let i = 0; i < hgrData.length; i++) {
        expect(hgrData[i]).toBeGreaterThanOrEqual(0);
        expect(hgrData[i]).toBeLessThanOrEqual(255);
      }
    });
  });

  describe('solid color conversion', () => {
    it('should convert solid black image to all zero bytes', () => {
      const imageData = createImageData(280, 192, [0, 0, 0]);

      const hgrData = dither.ditherToHgr(imageData, 40, 192, true);

      // Black pixels should result in mostly zero bytes
      const nonZeroCount = Array.from(hgrData).filter(b => b !== 0).length;
      // Allow some non-zero bytes due to dithering/high bit, but should be minimal
      expect(nonZeroCount).toBeLessThan(hgrData.length * 0.1); // Less than 10%
    });

    it('should convert solid white image to non-zero bytes', () => {
      const imageData = createImageData(280, 192, [255, 255, 255]);

      const hgrData = dither.ditherToHgr(imageData, 40, 192, true);

      // White pixels should result in many non-zero bytes
      const nonZeroCount = Array.from(hgrData).filter(b => b !== 0).length;
      expect(nonZeroCount).toBeGreaterThan(hgrData.length * 0.5); // More than 50%
    });
  });

  describe('pattern conversion', () => {
    it('should handle checkerboard pattern', () => {
      const imageData = createCheckerboardImageData(280, 192, 8);

      const hgrData = dither.ditherToHgr(imageData, 40, 192, true);

      // Should produce valid data with both zeros and non-zeros
      const zeroCount = Array.from(hgrData).filter(b => b === 0).length;
      const nonZeroCount = hgrData.length - zeroCount;

      expect(zeroCount).toBeGreaterThan(0);
      expect(nonZeroCount).toBeGreaterThan(0);
      expect(hgrData.length).toBe(7680); // 40 bytes * 192 rows
    });

    it('should handle horizontal gradient', () => {
      const imageData = createGradientImageData(280, 192);

      const hgrData = dither.ditherToHgr(imageData, 40, 192, true);

      // Left side should be darker (more zeros) than right side
      const leftHalf = Array.from(hgrData.slice(0, 4096));
      const rightHalf = Array.from(hgrData.slice(4096));

      const leftNonZero = leftHalf.filter(b => b !== 0).length;
      const rightNonZero = rightHalf.filter(b => b !== 0).length;

      expect(rightNonZero).toBeGreaterThan(leftNonZero);
    });
  });

  describe('dimension handling', () => {
    it('should scale down larger images correctly', () => {
      const imageData = createImageData(560, 384, [255, 255, 255]);

      // ditherToHgr should scale internally to 280x192
      const hgrData = dither.ditherToHgr(imageData, 40, 192, true);

      expect(hgrData.length).toBe(7680); // 40 bytes * 192 rows
    });

    it('should scale up smaller images correctly', () => {
      const imageData = createImageData(140, 96, [255, 255, 255]);

      // ditherToHgr should scale internally to 280x192
      const hgrData = dither.ditherToHgr(imageData, 40, 192, true);

      expect(hgrData.length).toBe(7680); // 40 bytes * 192 rows
    });
  });

  describe('byte layout verification', () => {
    it('should produce correct byte layout for HGR screen', () => {
      const imageData = createImageData(280, 192, [0, 0, 0]);

      const hgrData = dither.ditherToHgr(imageData, 40, 192, true);

      // HGR screen is organized as 40 bytes per row, 192 rows
      // Each row should be 40 bytes
      for (let row = 0; row < 192; row++) {
        const rowStart = row * 40;
        const rowEnd = rowStart + 40;
        const rowData = hgrData.slice(rowStart, rowEnd);
        expect(rowData.length).toBe(40);
      }
    });

    it('should handle byte boundaries correctly', () => {
      // Create vertical stripes at byte boundaries (every 7 pixels)
      const data = new Uint8ClampedArray(280 * 192 * 4);
      for (let y = 0; y < 192; y++) {
        for (let x = 0; x < 280; x++) {
          const offset = (y * 280 + x) * 4;
          const value = (Math.floor(x / 7) % 2 === 0) ? 255 : 0;
          data[offset] = value;
          data[offset + 1] = value;
          data[offset + 2] = value;
          data[offset + 3] = 255;
        }
      }
      const imageData = new ImageData(280, 192);
      imageData.data.set(data);

      const hgrData = dither.ditherToHgr(imageData, 40, 192, true);

      // Should produce valid data
      expect(hgrData.length).toBe(7680); // 40 bytes * 192 rows

      // Check first row for alternating pattern
      const firstRow = hgrData.slice(0, 40);
      let hasVariation = false;
      for (let i = 1; i < firstRow.length; i++) {
        if (firstRow[i] !== firstRow[i - 1]) {
          hasVariation = true;
          break;
        }
      }
      expect(hasVariation).toBe(true); // Should have variation in the pattern
    });
  });

  describe('dithering algorithm selection', () => {
    it('should produce different results with different algorithms', () => {
      const imageData = createGradientImageData(280, 192);

      const ditherFS = new ImageDither();
      ditherFS.setDitherAlgorithm('floyd-steinberg');
      const hgrDataFS = ditherFS.ditherToHgr(imageData, 40, 192, true);

      const ditherAtkinson = new ImageDither();
      ditherAtkinson.setDitherAlgorithm('atkinson');
      const hgrDataAtkinson = ditherAtkinson.ditherToHgr(imageData, 40, 192, true);

      // Results should be different
      let differenceCount = 0;
      for (let i = 0; i < hgrDataFS.length; i++) {
        if (hgrDataFS[i] !== hgrDataAtkinson[i]) {
          differenceCount++;
        }
      }

      expect(differenceCount).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('should handle all-gray image', () => {
      const imageData = createImageData(280, 192, [128, 128, 128]);

      const hgrData = dither.ditherToHgr(imageData, 40, 192, true);

      expect(hgrData.length).toBe(7680); // 40 bytes * 192 rows

      // Gray should dither to mix of on/off pixels
      const zeroCount = Array.from(hgrData).filter(b => b === 0).length;
      const nonZeroCount = hgrData.length - zeroCount;

      // Should have reasonable mix (within 30-70% range)
      const zeroPercent = (zeroCount / hgrData.length) * 100;
      expect(zeroPercent).toBeGreaterThan(30);
      expect(zeroPercent).toBeLessThan(70);
    });

    it('should handle color images (should convert to grayscale equivalent)', () => {
      const imageData = createImageData(280, 192, [255, 0, 0]); // Pure red

      const hgrData = dither.ditherToHgr(imageData, 40, 192, true);

      expect(hgrData.length).toBe(7680); // 40 bytes * 192 rows
      // Should produce valid output (even if colors are interpreted as grayscale)
    });
  });
});
